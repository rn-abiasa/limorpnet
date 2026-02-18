import { Block } from "../core/Block.js";
import { Transaction } from "../core/Transaction.js";
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

      case MSG.REQUEST_CHAIN:
        this._handleChainRequest(ws);
        break;

      case MSG.RESPONSE_CHAIN:
        await this._handleChainResponse(data);
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
        // Might need chain sync
        this.p2p._sendChainRequest(ws);
      }
    } catch (err) {
      logger.warn("Error handling new block", { error: err.message });
    }
  }

  async _handleNewTx(data, ws) {
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

  _handleChainRequest(ws) {
    const chain = this.blockchain.toJSON();
    this.p2p._send(ws, MSG.RESPONSE_CHAIN, chain);
  }

  async _handleChainResponse(chainData) {
    try {
      const incomingChain = chainData.map((b) => Block.fromJSON(b));
      const replaced = await this.blockchain.resolveConflict(incomingChain);
      if (replaced) {
        logger.info("Chain replaced via sync", {
          newHeight: incomingChain.length - 1,
        });
      }
    } catch (err) {
      logger.warn("Error handling chain response", { error: err.message });
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
