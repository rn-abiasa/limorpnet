import { sha256, serialize } from "../utils/crypto.js";
import { TX_TYPE } from "../core/transaction.js";
import { createLogger } from "../utils/logger.js";
import { calculateBlockReward, splitFee } from "../utils/rewards.js";

const logger = createLogger("StateManager");

/**
 * Account structure:
 * {
 *   balance: string (BigInt as string),
 *   nonce:   number,
 *   code:    string | null,    // contract bytecode
 *   storage: object,           // contract storage
 *   stake:   string (BigInt),  // staked amount
 *   mined:   string (BigInt),  // total rewards mined
 * }
 */

export class StateManager {
  /**
   * @param {import('./Database.js').Database} db
   * @param {import('../vm/ContractVM.js').ContractVM} contractVM
   */
  constructor(db, contractVM) {
    this.db = db;
    this.contractVM = contractVM;
  }

  // ─── Account Access ────────────────────────────────────────────────────────

  async getAccount(address) {
    const raw = await this.db.get(`state:account:${address}`).catch(() => null);
    if (!raw) return null;
    const acc = JSON.parse(raw);
    acc.balance = BigInt(acc.balance);
    acc.stake = BigInt(acc.stake || "0");
    acc.mined = BigInt(acc.mined || "0");
    return acc;
  }

  async getOrCreateAccount(address) {
    return (
      (await this.getAccount(address)) ?? {
        balance: 0n,
        nonce: 0,
        code: null,
        storage: {},
        stake: 0n,
        mined: 0n,
      }
    );
  }

  async saveAccount(address, account) {
    await this.db.put(
      `state:account:${address}`,
      JSON.stringify({
        balance: account.balance.toString(),
        nonce: account.nonce,
        code: account.code ?? null,
        storage: account.storage ?? {},
        stake: account.stake.toString(),
        mined: (account.mined || 0n).toString(),
      }),
    );
  }

  // ─── Genesis ────────────────────────────────────────────────────────────────

  async applyGenesis(initialState) {
    for (const [address, data] of Object.entries(initialState)) {
      await this.saveAccount(address, {
        balance: BigInt(data.balance || "0"),
        nonce: 0,
        code: null,
        storage: {},
        stake: BigInt(data.stake || "0"),
      });
    }

    let supply = 0n;
    for (const data of Object.values(initialState)) {
      supply += BigInt(data.balance || "0");
      supply += BigInt(data.stake || "0");
    }
    await this.db.put("state:totalSupply", supply.toString());
    logger.info("Total supply initialized", { supply: supply.toString() });
  }

  // ─── Block Application ──────────────────────────────────────────────────────

  /**
   * Apply all transactions in a block atomically
   * @param {import('../core/block.js').Block} block
   * @returns {{ ok: boolean, error?: string }}
   */
  async applyBlock(block) {
    // Collect all state changes in memory first
    const changes = new Map(); // address -> account

    const getAcc = async (addr) => {
      if (changes.has(addr)) return changes.get(addr);
      return this.getOrCreateAccount(addr);
    };

    let totalFees = 0n;

    for (const txData of block.transactions) {
      const result = await this._applyTx(txData, getAcc, changes, block);
      if (!result.ok) {
        logger.warn("Tx failed in block", {
          hash: txData.hash,
          error: result.error,
        });
        continue;
      }
      totalFees += BigInt(txData.fee || 0);
    }

    // Hitung reward dan distribusi fee
    const blockReward = calculateBlockReward(block.index);
    const { toValidator } = splitFee(totalFees);

    // Berikan reward + porsi fee ke validator
    const validatorAcc = await getAcc(block.validator);
    const totalReward = blockReward + toValidator;
    validatorAcc.balance += totalReward;
    validatorAcc.mined = (validatorAcc.mined || 0n) + totalReward;
    changes.set(block.validator, validatorAcc);

    logger.info("Block applied with tokenomics", {
      index: block.index,
      reward: blockReward.toString(),
      feesCollected: totalFees.toString(),
      feesBurned: (totalFees - toValidator).toString(),
    });

    // Persist all changes in one batch
    const ops = [];
    for (const [address, account] of changes) {
      ops.push({
        type: "put",
        key: `state:account:${address}`,
        value: JSON.stringify({
          balance: account.balance.toString(),
          nonce: account.nonce,
          code: account.code ?? null,
          storage: account.storage ?? {},
          stake: account.stake.toString(),
          mined: (account.mined || 0n).toString(),
        }),
      });
    }

    // Update Total Supply
    // Supply = Old + Reward - BurnedFees
    let currentSupply = await this.getTotalSupply();
    const burnedFees = totalFees - toValidator;
    currentSupply = currentSupply + blockReward - burnedFees;

    ops.push({
      type: "put",
      key: "state:totalSupply",
      value: currentSupply.toString(),
    });

    await this.db.batch(ops);

    return { ok: true };
  }

  async _applyTx(txData, getAcc, changes, block) {
    const from = await getAcc(txData.from);

    // Nonce check
    if (txData.nonce !== from.nonce) {
      return {
        ok: false,
        error: `Nonce mismatch: expected ${from.nonce}, got ${txData.nonce}`,
      };
    }

    const totalCost = BigInt(txData.amount) + BigInt(txData.fee);
    if (from.balance < totalCost) {
      return { ok: false, error: "Insufficient balance" };
    }

    // Deduct from sender
    from.balance -= totalCost;
    from.nonce += 1;
    changes.set(txData.from, from);

    switch (txData.type) {
      case TX_TYPE.TRANSFER: {
        const to = await getAcc(txData.to);
        to.balance += BigInt(txData.amount);
        changes.set(txData.to, to);
        break;
      }

      case TX_TYPE.DEPLOY: {
        const contractAddress = this._deriveContractAddress(
          txData.from,
          txData.nonce - 1,
        );
        const contract = await getAcc(contractAddress);
        contract.code = txData.data;
        contract.storage = {};

        // Run constructor
        const vmResult = await this.contractVM.deploy(txData.data, {
          sender: txData.from,
          value: BigInt(txData.amount),
          address: contractAddress,
          block: { number: block.index, timestamp: block.timestamp },
          storage: contract.storage,
        });

        if (!vmResult.ok) return { ok: false, error: vmResult.error };
        contract.storage = vmResult.storage;
        changes.set(contractAddress, contract);

        // Return contract address in a way callers can read
        txData._contractAddress = contractAddress;
        break;
      }

      case TX_TYPE.CALL: {
        const contract = await getAcc(txData.to);
        if (!contract.code) return { ok: false, error: "Not a contract" };

        const vmResult = await this.contractVM.call(
          contract.code,
          txData.data,
          {
            sender: txData.from,
            value: BigInt(txData.amount),
            address: txData.to,
            block: { number: block.index, timestamp: block.timestamp },
            storage: contract.storage,
          },
        );

        if (!vmResult.ok) return { ok: false, error: vmResult.error };
        contract.storage = vmResult.storage;
        changes.set(txData.to, contract);

        // Handle LMR transfers from contract
        if (vmResult.transfers) {
          for (const { to, amount } of vmResult.transfers) {
            const acc = await getAcc(to);
            acc.balance += BigInt(amount);
            changes.set(to, acc);
          }
        }
        break;
      }

      case TX_TYPE.STAKE: {
        from.stake += BigInt(txData.amount);
        changes.set(txData.from, from);
        break;
      }

      case TX_TYPE.UNSTAKE: {
        if (from.stake < BigInt(txData.amount)) {
          return { ok: false, error: "Insufficient stake" };
        }
        from.stake -= BigInt(txData.amount);
        from.balance += BigInt(txData.amount);
        changes.set(txData.from, from);
        break;
      }

      default:
        return { ok: false, error: `Unknown tx type: ${txData.type}` };
    }

    return { ok: true };
  }

  _deriveContractAddress(from, nonce) {
    return "0x" + sha256(serialize({ from, nonce })).slice(-40);
  }

  // ─── Validators ─────────────────────────────────────────────────────────────

  async getValidators() {
    const validators = [];
    for await (const { key, value } of this.db.iterate("state:account:")) {
      const acc = JSON.parse(value);
      if (BigInt(acc.stake || "0") > 0n) {
        const address = key.replace("state:account:", "");
        validators.push({ address, stake: BigInt(acc.stake) });
      }
    }
    return validators;
  }

  async getTotalSupply() {
    return BigInt(await this.db.get("state:totalSupply").catch(() => "0"));
  }

  /**
   * Recalculate and update the total supply from all accounts.
   */
  async recalculateTotalSupply() {
    logger.info("Recalculating total supply from scratch...");
    let total = 0n;
    for await (const { value } of this.db.iterate("state:account:")) {
      const acc = JSON.parse(value);
      total += BigInt(acc.balance || "0");
      total += BigInt(acc.stake || "0");
    }
    await this.db.put("state:totalSupply", total.toString());
    logger.info("Total supply recalculated and saved", {
      supply: total.toString(),
    });
    return total;
  }

  async ensureTotalSupply() {
    try {
      const supplyStr = await this.db.get("state:totalSupply");
      const supply = BigInt(supplyStr);

      // Simple heuristic: if supply is less than 1M LMR but we have a validator,
      // it's likely corrupted (genesis usually has ~10M+).
      if (supply < 1_000_000n * 1_000_000_000_000_000_000n) {
        logger.warn(
          "Total supply seems suspiciously low, triggering repair...",
        );
        await this.recalculateTotalSupply();
      }
    } catch {
      await this.recalculateTotalSupply();
    }
  }

  // ─── Reset ──────────────────────────────────────────────────────────────────

  async reset() {
    const keys = [];
    for await (const { key } of this.db.iterate("state:")) {
      keys.push(key);
    }
    await this.db.batch(keys.map((k) => ({ type: "del", key: k })));
    logger.info("State reset");
  }
}
