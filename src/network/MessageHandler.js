import { Block } from "../core/block.js";
import { Transaction } from "../core/transaction.js";
import { pipe } from "it-pipe";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import { lpStream } from "it-length-prefixed-stream";
import { createLogger } from "../utils/logger.js";
import { MSG_TOPICS } from "./P2PServer.js";

const logger = createLogger("MessageHandler");

export class MessageHandler {
  constructor({ blockchain, mempool, p2p }) {
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.p2p = p2p;
    this.isSyncing = false;
  }

  async _handleNewBlock(data) {
    if (this.blockchain.isSyncing) {
      logger.debug("Ignoring broadcast block during sync", {
        index: data.index,
      });
      return;
    }

    try {
      const block = Block.fromJSON(data);

      // Check if we already have this block
      if (this.blockchain.getBlock(block.hash)) return;

      const result = await this.blockchain.addBlock(block);
      if (result.ok) {
        logger.info("New block accepted from gossip", {
          index: block.index,
          hash: block.hash,
        });
        this.mempool.removeIncluded(block.transactions);
      } else {
        logger.warn("Block rejected from gossip", { error: result.error });
        if (result.error.includes("Chain link mismatch")) {
          this._triggerSync();
        }
      }
    } catch (err) {
      logger.warn("Error handling new block", { error: err.message });
    }
  }

  async _handleNewTx(data) {
    if (this.blockchain.isSyncing) {
      return; // Ignore broadcast txs during sync
    }

    try {
      const tx = Transaction.fromJSON(data);

      if (this.mempool.has(tx.hash)) return;

      const result = await this.mempool.addTransaction(tx, (addr) =>
        this.blockchain.stateManager.getAccount(addr),
      );

      if (result.ok) {
        logger.debug("New tx accepted from gossip", { hash: tx.hash });
      }
    } catch (err) {
      logger.warn("Error handling new tx", { error: err.message });
    }
  }

  /**
   * Handle direct stream for block synchronization
   */
  async handleSyncStream(stream) {
    const lp = lpStream(stream);

    for await (const msgBuffer of lp.source) {
      try {
        const msg = JSON.parse(uint8ArrayToString(msgBuffer.subarray()));

        if (msg.type === "REQUEST_BLOCKS") {
          const { fromIndex, count } = msg.data;
          const chainLength = this.blockchain.chain.length;
          const end = Math.min(fromIndex + count, chainLength);
          const blocks = [];
          for (let i = fromIndex; i < end; i++) {
            blocks.push(this.blockchain.chain[i].toJSON());
          }

          await lp.write(
            uint8ArrayFromString(
              JSON.stringify({
                type: "RESPONSE_BLOCKS",
                data: { fromIndex, blocks, totalHeight: chainLength - 1 },
              }),
            ),
          );
        }
      } catch (err) {
        logger.warn("Sync stream error", { error: err.message });
        break;
      }
    }
  }

  async _triggerSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    logger.info("Starting orchestrated sync via Libp2p streams");

    try {
      const peers = this.p2p.node.getPeers();
      if (peers.length === 0) {
        this.isSyncing = false;
        return;
      }

      // Pick a random peer to sync from
      const peer = peers[Math.floor(Math.random() * peers.length)];
      const stream = await this.p2p.node.dialProtocol(
        peer,
        "/limorp/sync/1.0.0",
      );
      const lp = lpStream(stream);

      let currentHeight = this.blockchain.getHeight();
      let targetHeight = currentHeight + 1;

      while (currentHeight < targetHeight) {
        await lp.write(
          uint8ArrayFromString(
            JSON.stringify({
              type: "REQUEST_BLOCKS",
              data: { fromIndex: currentHeight + 1, count: 100 },
            }),
          ),
        );

        const responseBuffer = await lp.read();
        if (!responseBuffer) break;

        const { data } = JSON.parse(
          uint8ArrayToString(responseBuffer.subarray()),
        );
        const { blocks, totalHeight } = data;

        targetHeight = totalHeight;
        const incomingBlocks = blocks.map((b) => Block.fromJSON(b));
        const replaced = await this.blockchain.resolveConflict(incomingBlocks);

        if (!replaced) break;

        currentHeight = this.blockchain.getHeight();
        logger.info("Sync progress", { currentHeight, targetHeight });
      }

      stream.close();
    } catch (err) {
      logger.error("Sync failed", { error: err.message });
    } finally {
      this.isSyncing = false;
    }
  }
}
