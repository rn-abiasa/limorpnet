import { Block } from "../core/block.js";
import { MSG } from "../network/P2PServer.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("BlockProducer");

export class BlockProducer {
  /**
   * @param {object} params
   * @param {import('../core/Blockchain.js').Blockchain} params.blockchain
   * @param {import('../core/Mempool.js').Mempool} params.mempool
   * @param {import('../consensus/PoS.js').PoS} params.pos
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
    const delay = Math.max(0, this.pos.blockTime - elapsed);
    this._timer = setTimeout(() => this._tryProduce(), delay);
  }

  async _tryProduce() {
    if (!this._running) return;

    try {
      const latest = this.blockchain.getLatestBlock();
      const validators = await this.stateManager.getValidators();

      // Check if we are the selected validator
      const selected = this.pos.selectValidator(validators, latest.hash);
      if (selected !== this.wallet.address) {
        logger.debug("Not our turn to produce", {
          selected,
          us: this.wallet.address,
        });
        this._schedule();
        return;
      }

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

    const block = new Block({
      index: latest.index + 1,
      previousHash: latest.hash,
      transactions: txs.map((tx) => tx.toJSON()),
      validator: this.wallet.address,
      timestamp: Date.now(),
      stateRoot: "",
    });

    // Validator signs the block
    this.wallet.signBlock(block);

    const result = await this.blockchain.addBlock(block);
    if (!result.ok) {
      logger.warn("Failed to add produced block", { error: result.error });
      return;
    }

    // Remove included txs from mempool
    this.mempool.removeIncluded(txs);

    // Broadcast to peers
    this.p2p.broadcast(MSG.NEW_BLOCK, block.toJSON());

    logger.info("Block produced", {
      index: block.index,
      hash: block.hash,
      txCount: txs.length,
      validator: this.wallet.address,
    });
  }
}
