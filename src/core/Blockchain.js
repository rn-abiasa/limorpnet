import { EventEmitter } from "events";
import { Block, createGenesisBlock } from "./Block.js";
import { Transaction } from "./Transaction.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Blockchain");

export class Blockchain extends EventEmitter {
  /**
   * @param {object} params
   * @param {import('../state/Database.js').Database} params.db
   * @param {import('../state/StateManager.js').StateManager} params.stateManager
   * @param {object} params.genesis - genesis config
   */
  constructor({ db, stateManager, genesis }) {
    super();
    this.db = db;
    this.stateManager = stateManager;
    this.genesis = genesis;
    this.chain = []; // in-memory chain (index -> Block)
  }

  async init() {
    const stored = await this.db.get("chain:height").catch(() => null);

    if (stored === null) {
      // First run — create genesis block
      const genesisBlock = createGenesisBlock(this.genesis);
      await this._saveBlock(genesisBlock);
      await this.stateManager.applyGenesis(this.genesis.initialState);
      logger.info("Genesis block created", { hash: genesisBlock.hash });
    } else {
      // Load chain from DB
      const height = parseInt(stored);
      for (let i = 0; i <= height; i++) {
        const raw = await this.db.get(`chain:block:${i}`);
        this.chain.push(Block.fromJSON(JSON.parse(raw)));
      }
      logger.info("Chain loaded from DB", { height });
    }
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getHeight() {
    return this.chain.length - 1;
  }

  getBlock(indexOrHash) {
    if (typeof indexOrHash === "number") {
      return this.chain[indexOrHash] ?? null;
    }
    return this.chain.find((b) => b.hash === indexOrHash) ?? null;
  }

  /**
   * Add a new block to the chain (after full validation)
   * @param {Block} block
   * @returns {{ ok: boolean, error?: string }}
   */
  async addBlock(block) {
    const latest = this.getLatestBlock();

    if (!block.isValid(latest)) {
      return { ok: false, error: "Block structurally invalid" };
    }

    if (!block.verifySignature()) {
      return { ok: false, error: "Block signature invalid" };
    }

    // Apply transactions to state
    const result = await this.stateManager.applyBlock(block);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    await this._saveBlock(block);
    this.emit("block:new", block);
    logger.info("Block added", {
      index: block.index,
      hash: block.hash,
      txCount: block.transactions.length,
    });

    return { ok: true };
  }

  /**
   * Replace chain if incoming is longer and valid (longest chain rule)
   * @param {Block[]} incomingChain
   * @returns {boolean} true if replaced
   */
  async resolveConflict(incomingChain) {
    if (incomingChain.length <= this.chain.length) return false;

    if (!this._isValidChain(incomingChain)) {
      logger.warn("Received invalid chain, ignoring");
      return false;
    }

    logger.info("Replacing chain", {
      oldHeight: this.getHeight(),
      newHeight: incomingChain.length - 1,
    });

    // Rebuild state from scratch
    await this.stateManager.reset();
    await this.stateManager.applyGenesis(this.genesis.initialState);

    this.chain = [];
    for (const block of incomingChain) {
      if (block.index === 0) {
        await this._saveBlock(block);
        continue;
      }
      await this.stateManager.applyBlock(block);
      await this._saveBlock(block);
    }

    this.emit("chain:replaced", this.chain);
    return true;
  }

  _isValidChain(chain) {
    if (chain[0].hash !== this.chain[0].hash) return false; // must share genesis

    for (let i = 1; i < chain.length; i++) {
      if (!chain[i].isValid(chain[i - 1])) return false;
      if (!chain[i].verifySignature()) return false;
    }
    return true;
  }

  async _saveBlock(block) {
    this.chain.push(block);
    const idx = block.index;
    await this.db.batch([
      {
        type: "put",
        key: `chain:block:${idx}`,
        value: JSON.stringify(block.toJSON()),
      },
      { type: "put", key: `chain:hash:${block.hash}`, value: String(idx) },
      { type: "put", key: "chain:height", value: String(idx) },
    ]);
  }

  toJSON() {
    return this.chain.map((b) => b.toJSON());
  }
}
