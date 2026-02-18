import { EventEmitter } from "events";
import { Block, createGenesisBlock } from "./block.js";
import { Transaction } from "./transaction.js";
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
    this.isSyncing = false;
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
      await this.stateManager.ensureTotalSupply();
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

    try {
      block.isValid(latest);
    } catch (err) {
      return { ok: false, error: err.message };
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
   * @param {Block[]} incomingBlocks
   * @returns {boolean} true if replaced
   */
  async resolveConflict(incomingBlocks) {
    if (this.isSyncing) return false;
    if (incomingBlocks.length === 0) return false;

    const first = incomingBlocks[0];
    const latest = this.getLatestBlock();

    // 1. Check if this is just an incremental update (tip of the chain)
    if (
      first.index === latest.index + 1 &&
      first.previousHash === latest.hash
    ) {
      for (const block of incomingBlocks) {
        const result = await this.addBlock(block);
        if (!result.ok) return false;
      }
      return true;
    }

    // 2. Check if this is a fork or a sync gap
    // If incoming blocks are entirely ahead of us, we can't verify them yet without the middle part
    if (first.index > latest.index + 1) {
      logger.debug("Received future blocks, ignoring until gap is filled", {
        first: first.index,
        local: latest.index,
      });
      return false;
    }

    // 3. Handle reorganization or filling gaps
    // Find the common ancestor
    let ancestorIdx = -1;
    for (let i = 0; i < incomingBlocks.length; i++) {
      const b = incomingBlocks[i];
      const local = this.getBlock(b.index);
      if (local && local.hash === b.hash) {
        ancestorIdx = b.index;
      } else {
        break; // Found the split point
      }
    }

    // If no common ancestor found in this chunk and it doesn't link to our chain
    if (ancestorIdx === -1 && first.index > 0) {
      const prevLocal = this.getBlock(first.index - 1);
      if (prevLocal && prevLocal.hash === first.previousHash) {
        ancestorIdx = first.index - 1;
      } else {
        logger.warn("Received blocks with no common ancestor in chunk", {
          first: first.index,
        });
        return false;
      }
    }

    // Only proceed if the incoming chain is actually better/longer
    const incomingLastBlock = incomingBlocks[incomingBlocks.length - 1];
    const newHeight = incomingLastBlock.index;

    if (newHeight < latest.index) return false;

    if (newHeight === latest.index) {
      // Tie-breaker: Deterministic rule (smaller hash wins)
      // This ensures all nodes eventually converge on the same branch
      if (incomingLastBlock.hash >= latest.hash) {
        return false;
      }
      logger.info(
        "Switching to a fork of the same height (deterministic tie-break)",
        {
          local: latest.hash.slice(0, 8),
          incoming: incomingLastBlock.hash.slice(0, 8),
        },
      );
    }

    this.isSyncing = true;
    try {
      logger.info("Resolving chain conflict", {
        ancestor: ancestorIdx,
        localHeight: latest.index,
        newHeight,
      });

      // Rollback to ancestor if needed
      if (ancestorIdx < latest.index) {
        await this.rollback(ancestorIdx);
      }

      // Apply new blocks from the split point
      const startIdxInChunk = incomingBlocks.findIndex(
        (b) => b.index === ancestorIdx + 1,
      );
      const blocksToApply =
        startIdxInChunk === -1
          ? incomingBlocks
          : incomingBlocks.slice(startIdxInChunk);

      for (const block of blocksToApply) {
        const result = await this.addBlock(block);
        if (!result.ok) {
          logger.error("Failed to apply block during resolution", {
            index: block.index,
            error: result.error,
          });
          // If we fail here, the chain is in a weird state. In a real node, we'd need more complex recovery.
          return false;
        }
      }

      return true;
    } catch (err) {
      logger.error("Critical error during resolveConflict", {
        error: err.message,
      });
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Revert blockchain and state to a specific height
   * @param {number} targetIndex
   */
  async rollback(targetIndex) {
    if (targetIndex >= this.chain.length - 1) return;

    logger.warn("Rolling back chain", {
      from: this.getHeight(),
      to: targetIndex,
    });

    // 1. Update in-memory chain
    this.chain = this.chain.slice(0, targetIndex + 1);

    // 2. We must rebuild the state at targetIndex
    // Simplified: Reset and apply from 0 to targetIndex
    // TODO: In production, use state snapshots or proper reversible state changes
    await this.stateManager.reset();
    await this.stateManager.applyGenesis(this.genesis.initialState);

    for (let i = 1; i <= targetIndex; i++) {
      const result = await this.stateManager.applyBlock(this.chain[i]);
      if (!result.ok)
        throw new Error(`Rollback failed: could not re-apply block ${i}`);
    }

    // 3. Update DB height
    await this.db.put("chain:height", String(targetIndex));
  }

  _isValidChain(chain) {
    if (chain[0].hash !== this.chain[0].hash) {
      logger.warn("Invalid chain: Genesis hash mismatch", {
        received: chain[0].hash.slice(0, 8),
        local: this.chain[0].hash.slice(0, 8),
      });
      return false;
    }

    for (let i = 1; i < chain.length; i++) {
      try {
        chain[i].isValid(chain[i - 1]);
        if (!chain[i].verifySignature()) {
          logger.warn("Invalid chain: Signature verification failed", {
            index: chain[i].index,
            hash: chain[i].hash.slice(0, 8),
          });
          return false;
        }
      } catch (err) {
        logger.warn("Invalid chain: Block validation failed", {
          index: chain[i].index,
          error: err.message,
        });
        return false;
      }
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
