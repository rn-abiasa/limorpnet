import { EventEmitter } from "events";
import { sha256, serialize } from "../utils/crypto.js";
import { StateTree } from "./StateTree.js";
import { TX_TYPE } from "../core/transaction.js";
import { createLogger } from "../utils/logger.js";
import { calculateBlockReward } from "../utils/rewards.js";

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

export class StateManager extends EventEmitter {
  /**
   * @param {import('./Database.js').Database} db
   * @param {import('../vm/ContractVM.js').ContractVM} contractVM
   */
  constructor(db, contractVM) {
    super();
    this.db = db;
    this.contractVM = contractVM;
  }

  // ─── Account Access ────────────────────────────────────────────────────────

  async getAccount(address) {
    const addr = address.toLowerCase();
    const raw = await this.db.get(`state:account:${addr}`).catch(() => null);
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
    const addr = address.toLowerCase();
    await this.db.put(
      `state:account:${addr}`,
      JSON.stringify(
        {
          balance: account.balance.toString(),
          nonce: account.nonce,
          code: account.code ?? null,
          storage: account.storage ?? {},
          stake: account.stake.toString(),
          mined: (account.mined || 0n).toString(),
        },
        (k, v) => (typeof v === "bigint" ? v.toString() : v),
      ),
    );
  }

  // ─── Genesis ────────────────────────────────────────────────────────────────

  async applyGenesis(initialState) {
    for (const [address, data] of Object.entries(initialState)) {
      const addr = address.toLowerCase();
      await this.saveAccount(addr, {
        balance: BigInt(data.balance || "0"),
        nonce: 0,
        code: null,
        storage: {},
        stake: BigInt(data.stake || "0"),
        mined: 0n, // Ensure mined is initialized for new accounts
      });
    }

    // Calculate and save the stateRoot
    const allAccounts = await this.getAllAccounts();
    const root = StateTree.calculateRoot(allAccounts);
    await this.db.put("state:root", root);

    let supply = 0n;
    for (const data of Object.values(initialState)) {
      supply += BigInt(data.balance || "0");
      supply += BigInt(data.stake || "0");
    }
    await this.db.put("state:totalSupply", supply.toString());
    logger.info("Total supply initialized", {
      supply: supply.toString(),
      stateRoot: root,
    });
    return root;
  }

  async getAllAccounts() {
    const accounts = new Map();
    for await (const { key, value } of this.db.iterate("state:account:")) {
      const address = key.replace("state:account:", "");
      const acc = JSON.parse(value);
      // Ensure BigInts are correct for hashing consistency
      acc.balance = BigInt(acc.balance);
      acc.stake = BigInt(acc.stake || "0");
      acc.mined = BigInt(acc.mined || "0");
      accounts.set(address, acc);
    }
    return accounts;
  }

  // ─── Block Application ──────────────────────────────────────────────────────

  /**
   * Apply all transactions in a block atomically
   * @param {import('../core/block.js').Block} block
   * @param {object} options - { commit: boolean }
   * @returns {{ ok: boolean, error?: string, stateRoot?: string }}
   */
  async applyBlock(block, options = { commit: true }) {
    // Collect all state changes in memory first
    const changes = new Map(); // address -> account

    const getAcc = async (addr) => {
      if (changes.has(addr)) return changes.get(addr);
      return this.getOrCreateAccount(addr);
    };

    let blockGasUsed = 0n;
    let totalPriorityRewards = 0n;
    let totalBaseFeeBurned = 0n;

    const events = [];
    const receipts = [];

    for (const txData of block.transactions) {
      // Per-transaction event collection for the receipt
      const beforeEventsLen = events.length;

      // Validate baseFee requirement
      if (txData.maxFeePerGas < block.baseFee) {
        logger.warn("Tx rejected: maxFeePerGas < baseFee", {
          hash: txData.hash,
          maxFee: txData.maxFeePerGas.toString(),
          baseFee: block.baseFee.toString(),
        });
        continue;
      }

      const result = await this._applyTx(
        txData,
        getAcc,
        changes,
        block,
        events,
      );

      // Gas accounting
      const gasUsed = result.gasUsed || 21000n;
      blockGasUsed += gasUsed;

      // EIP-1559 Fee Distribution
      const priorityFee =
        txData.maxFeePerGas - block.baseFee > txData.maxPriorityFeePerGas
          ? txData.maxPriorityFeePerGas
          : txData.maxFeePerGas - block.baseFee;

      const priorityReward = gasUsed * priorityFee;
      const baseFeeBurn = gasUsed * block.baseFee;

      totalPriorityRewards += priorityReward;
      totalBaseFeeBurned += baseFeeBurn;

      // Construct Receipt
      const receipt = {
        txHash: txData.hash,
        status: result.ok ? 1 : 0,
        gasUsed: gasUsed.toString(),
        baseFee: block.baseFee.toString(),
        priorityFee: priorityFee.toString(),
        contractAddress: txData._contractAddress || null,
        logs: events.slice(beforeEventsLen).map((e) => ({
          event: e.event,
          data: e.data,
          contract: e.contract,
        })),
        error: result.ok ? null : result.error,
        blockIndex: block.index,
        timestamp: block.timestamp,
      };
      receipts.push(receipt);

      // If VM fails, fee is taken and it returns {ok:false}.
    }

    // Set final gasUsed in block
    block.gasUsed = blockGasUsed;

    // Hitung reward dan distribusi fee
    const blockReward = calculateBlockReward(block.index);

    // Berikan block reward + total priority fees ke validator
    const validatorAcc = await getAcc(block.validator);
    const totalReward = blockReward + totalPriorityRewards;
    validatorAcc.balance += totalReward;
    validatorAcc.mined = (validatorAcc.mined || 0n) + totalReward;
    changes.set(block.validator, validatorAcc);

    // Recalculate stateRoot based on changes + existing DB accounts
    const allAccounts = await this.getAllAccounts();
    // Merge changes into allAccounts
    for (const [address, acc] of changes) {
      allAccounts.set(address, acc);
    }
    const stateRoot = StateTree.calculateRoot(allAccounts);

    if (!options.commit) {
      return { ok: true, stateRoot };
    }

    // Persist all changes in one batch
    const ops = [];
    for (const [address, account] of changes) {
      ops.push({
        type: "put",
        key: `state:account:${address}`,
        value: JSON.stringify(
          {
            balance: account.balance.toString(),
            nonce: account.nonce,
            code: account.code ?? null,
            storage: account.storage ?? {},
            stake: account.stake.toString(),
            mined: (account.mined || 0n).toString(),
          },
          (k, v) => (typeof v === "bigint" ? v.toString() : v),
        ),
      });
    }

    // Update Total Supply
    let currentSupply = await this.getTotalSupply();
    currentSupply = currentSupply + blockReward - totalBaseFeeBurned;

    ops.push({
      type: "put",
      key: "state:totalSupply",
      value: currentSupply.toString(),
    });

    // Save Receipts & Events
    for (const receipt of receipts) {
      ops.push({
        type: "put",
        key: `state:receipt:${receipt.txHash}`,
        value: JSON.stringify(receipt, (k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      });
    }

    for (const { txHash, contract, event, data } of events) {
      ops.push({
        type: "put",
        key: `state:event:${txHash}:${Date.now()}`,
        value: JSON.stringify(
          {
            contract,
            event,
            data,
            blockIndex: block.index,
          },
          (k, v) => (typeof v === "bigint" ? v.toString() : v),
        ),
      });
    }

    await this.db.batch(ops);
    await this.db.put("state:root", stateRoot);

    // Emit events for WebSocket subscribers
    for (const e of events) {
      this.emit("event:new", { ...e, blockIndex: block.index });
    }

    return { ok: true, stateRoot };
  }

  async _applyTx(txData, getAcc, changes, block, events) {
    const from = await getAcc(txData.from);

    // Nonce check
    if (txData.nonce !== from.nonce) {
      return {
        ok: false,
        error: `Nonce mismatch: expected ${from.nonce}, got ${txData.nonce}`,
      };
    }

    // Gas limit MUST at least cover transfer
    const gasLimit = BigInt(txData.gasLimit || 21000n);
    const maxFee = BigInt(txData.maxFeePerGas || 0n);

    const maxTxCost = BigInt(txData.amount) + gasLimit * maxFee;
    if (from.balance < maxTxCost) {
      return {
        ok: false,
        error: "Insufficient balance to cover amount + max gas fee",
      };
    }

    // Charge the MAXIMUM possible fee upfront (for simplicity)
    // In production, you'd only charge effectivePrice * gasUsed at the end.
    // For Limorp, we charge the effective price now.
    const priorityFee =
      txData.maxFeePerGas - block.baseFee > txData.maxPriorityFeePerGas
        ? txData.maxPriorityFeePerGas
        : txData.maxFeePerGas - block.baseFee;
    const effectivePrice = block.baseFee + priorityFee;

    // Fixed gas for simple TXs
    let gasUsed = 21000n;

    // Deduct from sender upfront.
    // We increment nonce and save sender state immediately to prevent double spending even on VM failure.
    from.nonce += 1;
    changes.set(txData.from, from);

    switch (txData.type) {
      case TX_TYPE.TRANSFER: {
        const to = await getAcc(txData.to);
        const actualFee = gasUsed * effectivePrice;
        from.balance -= BigInt(txData.amount) + actualFee;
        to.balance += BigInt(txData.amount);
        changes.set(txData.to, to);
        return { ok: true, gasUsed };
      }

      case TX_TYPE.DEPLOY: {
        const result = await this._executeDeploy(
          txData.from,
          txData.amount,
          txData.data,
          txData.nonce,
          block,
          getAcc,
          changes,
          gasLimit - 21000n,
          effectivePrice,
        );
        gasUsed += BigInt(result.gasUsed || 0);
        if (!result.ok) return { ok: false, error: result.error, gasUsed };
        txData._contractAddress = result.contractAddress;
        return { ok: true, gasUsed };
      }

      case TX_TYPE.CALL: {
        const vmResult = await this._executeCall(
          txData.to,
          txData.from,
          BigInt(txData.amount),
          txData.data,
          block,
          getAcc,
          changes,
          events,
          txData.hash,
          gasLimit - 21000n,
          effectivePrice,
        );

        gasUsed += BigInt(vmResult.gasUsed || 0);
        const actualFee = gasUsed * effectivePrice;
        from.balance -= BigInt(txData.amount) + actualFee;
        changes.set(txData.from, from);

        // Correctly credit the recipient contract with msg.value
        const toAcc = await getAcc(txData.to);
        toAcc.balance += BigInt(txData.amount);
        changes.set(txData.to, toAcc);

        if (!vmResult.ok) return { ok: false, error: vmResult.error, gasUsed };
        return { ok: true, gasUsed };
      }

      case TX_TYPE.STAKE: {
        const amount = BigInt(txData.amount);
        const actualFee = gasUsed * effectivePrice;
        const totalCost = amount + actualFee;

        if (from.balance < totalCost) {
          return { ok: false, error: "Insufficient balance to stake" };
        }

        from.balance -= totalCost;
        from.stake += amount;
        changes.set(txData.from, from);
        break;
      }

      case TX_TYPE.UNSTAKE: {
        const amount = BigInt(txData.amount);
        const actualFee = gasUsed * effectivePrice;

        if (from.stake < amount) {
          return { ok: false, error: "Insufficient stake" };
        }
        if (from.balance < actualFee) {
          return { ok: false, error: "Insufficient balance for unstake fee" };
        }

        from.stake -= amount;
        from.balance += amount - actualFee;
        changes.set(txData.from, from);
        break;
      }

      default:
        return { ok: false, error: `Unknown tx type: ${txData.type}` };
    }

    return { ok: true };
  }

  async _executeCall(
    target,
    sender,
    value,
    data,
    block,
    getAcc,
    changes,
    allEvents,
    txHash,
    gasLimit,
    effectivePrice,
  ) {
    const contract = await getAcc(target);
    if (!contract.code)
      return { ok: false, error: "Not a contract", gasUsed: 0n };

    const contractEvents = [];
    // console.log(`[DEBUG] _executeCall START target=${target} storage=`, contract.storage);
    const vmResult = await this.contractVM.call(contract.code, data, {
      sender,
      value: BigInt(value),
      address: target,
      block: { number: block.index, timestamp: block.timestamp },
      storage: contract.storage,
      events: contractEvents,
      gasLimit: BigInt(gasLimit),
      deploy: async (code, args, value, deployGasLimit) => {
        const fromAcc = await getAcc(target);
        const deployNonce = fromAcc.nonce;
        fromAcc.nonce += 1;
        changes.set(target, fromAcc);

        return this._executeDeploy(
          target,
          value,
          JSON.stringify({ code, args }),
          deployNonce,
          block,
          getAcc,
          changes,
          deployGasLimit,
          effectivePrice,
        );
      },
      call: async (subTarget, subMethod, subArgs, subValue, subGasLimit) => {
        return this._executeCall(
          subTarget,
          target,
          subValue,
          { method: subMethod, args: subArgs },
          block,
          getAcc,
          changes,
          allEvents,
          txHash,
          subGasLimit,
          effectivePrice,
        );
      },
    });

    if (!vmResult.ok) return vmResult;

    // Apply state changes
    contract.storage = vmResult.storage;
    changes.set(target, contract);

    // Handle transfers
    if (vmResult.transfers) {
      for (const { to, amount } of vmResult.transfers) {
        const val = BigInt(amount);
        if (contract.balance < val) {
          return {
            ok: false,
            error: "Insufficient contract balance for internal transfer",
            gasUsed: vmResult.gasUsed,
          };
        }

        const acc = await getAcc(to);
        acc.balance += val;
        contract.balance -= val;

        changes.set(to, acc);
        changes.set(target, contract);
      }
    }

    // Collect events
    for (const e of contractEvents) {
      allEvents.push({ ...e, txHash, contract: target });
    }

    return vmResult;
  }

  async _executeDeploy(
    sender,
    value,
    data,
    nonce,
    block,
    getAcc,
    changes,
    gasLimit,
    effectivePrice,
  ) {
    const contractAddress = this._deriveContractAddress(sender, nonce);

    let code = data;
    let args = [];

    try {
      if (data.trim().startsWith("{")) {
        const parsed = JSON.parse(data);
        if (parsed.code) {
          code = parsed.code;
          args = parsed.args || [];
        }
      }
    } catch (e) {}

    let contract = await getAcc(contractAddress);
    if (!contract) {
      contract = {
        balance: 0n,
        nonce: 0,
        code: null,
        storage: {},
        stake: 0n,
        mined: 0n,
      };
    }
    contract.code = code;
    contract.storage = {};

    const vmResult = await this.contractVM.deploy(code, args, {
      sender,
      value: BigInt(value),
      address: contractAddress,
      block: { number: block.index, timestamp: block.timestamp },
      storage: contract.storage,
      gasLimit: BigInt(gasLimit),
    });

    const gasUsed = vmResult.gasUsed || 0n;
    const totalCost = BigInt(value) + gasUsed * effectivePrice;

    const fromAcc = await getAcc(sender);
    fromAcc.balance -= totalCost;
    changes.set(sender, fromAcc);

    if (!vmResult.ok) return { ok: false, error: vmResult.error, gasUsed };

    contract.storage = vmResult.storage;
    changes.set(contractAddress, contract);

    return { ok: true, contractAddress, gasUsed };
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
        const address = key.replace("state:account:", "").toLowerCase();
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
