import { Block } from "../core/block.js";
import { MSG_TOPICS } from "../network/P2PServer.js";
import { createLogger } from "../utils/logger.js";
import { PoS } from "./pos.js";

const logger = createLogger("BlockProducer");

export class BlockProducer {
  /**
   * @param {object} params
   * @param {import('../core/Blockchain.js').Blockchain} params.blockchain
   * @param {import('../core/Mempool.js').Mempool} params.mempool
   * @param {import('../consensus/pos.js').PoS} params.pos
   * @param {import('../network/P2PServer.js').P2PServer} params.p2p
   * @param {import('../state/StateManager.js').StateManager} params.stateManager
   * @param {import('../wallet/Wallet.js').Wallet} params.wallet - validator wallet
   */
  constructor({ blockchain, mempool, pos, p2p, stateManager, wallet }) {
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.pos = pos;
    this.p2p = p2p;
    this.stateManager = stateManager;
    this.wallet = wallet;
    this._timer = null;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    logger.info("Block producer started", { validator: this.wallet.address });
    this._schedule();
  }

  stop() {
    this._running = false;
    if (this._timer) clearTimeout(this._timer);
    logger.info("Block producer stopped");
  }

  _schedule() {
    if (!this._running) return;
    const latest = this.blockchain.getLatestBlock();
    const elapsed = Date.now() - latest.timestamp;

    // Calculate how much time until the NEXT slot starts
    const slotDuration = this.pos.blockTime;
    const currentSlot = Math.floor(elapsed / slotDuration);
    const nextSlotStart = (currentSlot + 1) * slotDuration;
    const delay = Math.max(100, nextSlotStart - elapsed);

    this._timer = setTimeout(() => this._tryProduce(), delay);
  }

  async _tryProduce() {
    if (!this._running || this.blockchain.isSyncing) return;

    try {
      const latest = this.blockchain.getLatestBlock();
      const validators = await this.stateManager.getValidators();

      // Calculate current slot based on time elapsed since last block
      const elapsed = Date.now() - latest.timestamp;
      const slot = Math.floor(elapsed / this.pos.blockTime);

      if (slot < 1) {
        this._schedule();
        return;
      }

      // Check if we are the selected validator for this slot
      const selected = this.pos.selectValidator(validators, latest.hash, slot);
      const ourAddress = this.wallet.address.toLowerCase();

      if (!selected || selected.toLowerCase() !== ourAddress) {
        const totalStake = validators.reduce((s, v) => s + v.stake, 0n);
        logger.info("Slot waiting: Not our turn", {
          slot,
          leader: selected?.slice(0, 10),
          us: ourAddress.slice(0, 10),
          eligibleCount: validators.length,
          totalStake: totalStake.toString(),
        });

        // Failover safety: If we've missed many slots, maybe we are stuck or on a fork
        if (slot > 20 && slot % 10 === 0) {
          logger.warn("High slot count detected, forcing network resync", {
            slot,
          });
          this.p2p.requestSync(latest.index + 1);
        }

        this._schedule();
        return;
      }

      logger.info("Leadership slot detected! Producing block...", { slot });
      await this._produceBlock(latest);
    } catch (err) {
      logger.error("Block production error", { error: err.message });
    }

    this._schedule();
  }

  async _produceBlock(latest) {
    const txs = this.mempool.getTransactionsForBlock(
      parseInt(process.env.MAX_TX_PER_BLOCK || "200"),
    );

    // 1. Create draft block
    const block = new Block({
      index: latest.index + 1,
      previousHash: latest.hash,
      transactions: txs.map((tx) => tx.toJSON()),
      validator: this.wallet.address,
      timestamp: Date.now(),
      stateRoot: "", // Will be filled after execution
    });

    // 2. Execute block locally (simulated) to get stateRoot BEFORE signing
    // This mode DOES NOT write to DB.
    const executionResult = await this.stateManager.applyBlock(block, {
      commit: false,
    });

    if (!executionResult.ok) {
      logger.error("Failed to simulate produced block locally", {
        error: executionResult.error,
      });
      return;
    }

    // 3. Set stateRoot and recalculate hash
    block.stateRoot = executionResult.stateRoot;
    block.hash = block._calculateHash();

    // 4. Validator signs the final hash (including stateRoot)
    this.wallet.signBlock(block);

    // 5. Add to local blockchain (this will perform the actual COMMIT)
    const result = await this.blockchain.addBlock(block);
    if (!result.ok) {
      logger.warn("Failed to add produced block", { error: result.error });
      return;
    }

    // Remove included txs from mempool
    this.mempool.removeIncluded(txs);

    // Broadcast to peers
    this.p2p.broadcast(MSG_TOPICS.BLOCKS, block.toJSON());

    logger.info("Block produced", {
      index: block.index,
      hash: block.hash,
      txCount: txs.length,
      validator: this.wallet.address,
      stateRoot: block.stateRoot.slice(0, 10),
    });
  }
}
