import { Block } from "../core/block.js";
import { Transaction } from "../core/transaction.js";
import { MSG } from "./P2PServer.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("MessageHandler");

export class MessageHandler {
  constructor({ blockchain, mempool, p2p }) {
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.p2p = p2p;
  }

  async handle(msg, ws) {
    const { type, data } = msg;

    switch (type) {
      case MSG.NEW_BLOCK:
        await this._handleNewBlock(data, ws);
        break;

      case MSG.NEW_TX:
        await this._handleNewTx(data, ws);
        break;

      case MSG.REQUEST_BLOCKS:
        this._handleBlocksRequest(ws, data);
        break;

      case MSG.RESPONSE_BLOCKS:
        await this._handleBlocksResponse(data, ws);
        break;

      case MSG.NEW_PEER:
        this._handleNewPeer(data);
        break;

      case MSG.PING:
        this.p2p._send(ws, MSG.PONG, {});
        break;

      case MSG.PONG:
        // Heartbeat acknowledged
        break;

      default:
        logger.warn("Unknown message type", { type });
    }
  }

  async _handleNewBlock(data, ws) {
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
        logger.info("New block accepted from peer", {
          index: block.index,
          hash: block.hash,
        });
        // Remove included txs from mempool
        this.mempool.removeIncluded(block.transactions);
        // Relay to other peers
        this.p2p.broadcast(MSG.NEW_BLOCK, data, ws);
      } else {
        logger.warn("Block rejected from peer", { error: result.error });
        // Might need chain sync - request a small chunk from current height
        this.p2p._requestBlocks(ws, Math.max(0, data.index - 10), 50);
      }
    } catch (err) {
      logger.warn("Error handling new block", { error: err.message });
    }
  }

  async _handleNewTx(data, ws) {
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
        logger.debug("New tx accepted from peer", { hash: tx.hash });
        // Relay to other peers
        this.p2p.broadcast(MSG.NEW_TX, data, ws);
      }
    } catch (err) {
      logger.warn("Error handling new tx", { error: err.message });
    }
  }

  _handleBlocksRequest(ws, { fromIndex, count }) {
    const chainLength = this.blockchain.chain.length;
    const end = Math.min(fromIndex + count, chainLength);
    const blocks = [];

    for (let i = fromIndex; i < end; i++) {
      blocks.push(this.blockchain.chain[i].toJSON());
    }

    this.p2p._send(ws, MSG.RESPONSE_BLOCKS, {
      fromIndex,
      blocks,
      totalHeight: chainLength - 1,
    });
  }

  async _handleBlocksResponse({ fromIndex, blocks, totalHeight }, ws) {
    try {
      const incomingBlocks = blocks.map((b) => Block.fromJSON(b));

      // Resolve conflict / add blocks
      const replaced = await this.blockchain.resolveConflict(incomingBlocks);

      if (replaced) {
        logger.info("Blocks synced successfully", {
          from: fromIndex,
          to: fromIndex + blocks.length - 1,
          totalTip: totalHeight,
        });

        // If we haven't reached the tip, request next chunk
        const nextIdx = fromIndex + blocks.length;
        if (nextIdx <= totalHeight) {
          this.p2p._requestBlocks(ws, nextIdx, 100);
        }
      }
    } catch (err) {
      logger.warn("Error handling blocks response", { error: err.message });
    }
  }

  _handleNewPeer(data) {
    const { url } = data;
    if (url && !this.p2p.peers.has(url)) {
      logger.info("Discovered new peer", { url });
      this.p2p.connectToPeer(url);
    }
  }
}
