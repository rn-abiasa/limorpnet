import { EventEmitter } from "events";
import { Transaction } from "./transaction.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Mempool");

export class Mempool extends EventEmitter {
  constructor({ maxSize = 5000 } = {}) {
    super();
    this.maxSize = maxSize;
    /** @type {Map<string, Transaction>} */
    this.pending = new Map();
  }

  /**
   * Add a transaction to the mempool
   * @param {Transaction} tx
   * @param {Function} getAccount - async fn(address) => { balance, nonce }
   * @returns {{ ok: boolean, error?: string }}
   */
  async addTransaction(tx, getAccount) {
    if (this.pending.size >= this.maxSize) {
      return { ok: false, error: "Mempool is full" };
    }

    if (this.pending.has(tx.hash)) {
      return { ok: false, error: "Transaction already in mempool" };
    }

    if (!tx.isValid()) {
      return { ok: false, error: "Transaction structurally invalid" };
    }

    // Check nonce and balance
    const account = await getAccount(tx.from);
    const expectedNonce = account ? account.nonce : 0;

    if (tx.nonce !== expectedNonce) {
      return {
        ok: false,
        error: `Invalid nonce: expected ${expectedNonce}, got ${tx.nonce}`,
      };
    }

    const totalCost = tx.amount + tx.fee;
    const balance = account ? BigInt(account.balance) : 0n;

    if (balance < totalCost) {
      return {
        ok: false,
        error: `Insufficient balance: has ${balance}, needs ${totalCost}`,
      };
    }

    this.pending.set(tx.hash, tx);
    this.emit("tx:new", tx);
    logger.info("Transaction added", {
      hash: tx.hash,
      from: tx.from,
      type: tx.type,
    });
    return { ok: true };
  }

  /**
   * Get sorted transactions for block production (by fee desc, then nonce asc)
   * @param {number} limit
   * @returns {Transaction[]}
   */
  getTransactionsForBlock(limit = 200) {
    console.log(
      `[Mempool] Getting txs for block. Pending count: ${this.pending.size}`,
    );
    const txs = [...this.pending.values()]
      .sort((a, b) => {
        const feeDiff = Number(b.fee - a.fee);
        if (feeDiff !== 0) return feeDiff;
        return a.nonce - b.nonce;
      })
      .slice(0, limit);
    console.log(`[Mempool] Returning ${txs.length} transactions`);
    return txs;
  }

  /**
   * Remove transactions that are now included in a block
   * @param {Transaction[]} transactions
   */
  removeIncluded(transactions) {
    for (const tx of transactions) {
      this.pending.delete(tx.hash);
    }
  }

  /**
   * Remove transactions that have become invalid (e.g. after chain reorg)
   * @param {Function} getAccount
   */
  async prune(getAccount) {
    for (const [hash, tx] of this.pending) {
      const account = await getAccount(tx.from);
      const balance = account ? BigInt(account.balance) : 0n;
      if (balance < tx.amount + tx.fee) {
        this.pending.delete(hash);
        logger.debug("Pruned tx (insufficient balance)", { hash });
      }
    }
  }

  size() {
    return this.pending.size;
  }

  has(hash) {
    return this.pending.has(hash);
  }

  get(hash) {
    return this.pending.get(hash);
  }

  all() {
    return [...this.pending.values()];
  }

  clear() {
    this.pending.clear();
  }
}
