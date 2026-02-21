import { Block } from "../core/block.js";
import { Transaction } from "../core/transaction.js";
import { createLogger } from "../utils/logger.js";
import { MSG_TOPICS } from "./P2PServer.js";
import crypto from "crypto";

const logger = createLogger("MessageHandler");

export class MessageHandler {
  constructor({ blockchain, mempool, p2p }) {
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.p2p = p2p;
    this.isSyncing = false;
    this.seenMessages = new Set(); // For gossip deduplication
  }

  /**
   * Entry point for new Hyperswarm connections
   */
  handleSocket(socket) {
    let buffer = "";

    socket.on("data", async (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep the last incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          await this._processMessage(msg, socket);
        } catch (err) {
          logger.warn("P2P Message Parse Error", {
            error: err.message,
            line: line.slice(0, 50),
          });
        }
      }
    });
  }

  async _processMessage(msg, socket) {
    switch (msg.type) {
      case "GOSSIP":
        await this._handleGossip(msg, socket);
        break;
      case "SYNC_REQ":
        await this._handleSyncReq(msg, socket);
        break;
      case "SYNC_RES":
        // Sync results are handled via one-time listeners or specific resolution
        socket.emit("sync_response", msg.data);
        break;
      default:
        logger.debug("Unknown message type", { type: msg.type });
    }
  }

  async _handleGossip(msg, socket) {
    const msgId = crypto
      .createHash("sha256")
      .update(JSON.stringify(msg.data))
      .digest("hex");
    if (this.seenMessages.has(msgId)) return;
    this.seenMessages.add(msgId);

    // Expire old messages from set (keep it small)
    if (this.seenMessages.size > 1000) {
      const first = this.seenMessages.values().next().value;
      this.seenMessages.delete(first);
    }

    if (msg.topic === MSG_TOPICS.BLOCKS) {
      await this._handleNewBlock(msg.data);
    } else if (msg.topic === MSG_TOPICS.TXS) {
      await this._handleNewTx(msg.data);
    }

    // Re-flood to other peers (simple flooding)
    for (const conn of this.p2p.connections) {
      if (conn !== socket && !conn.destroyed) {
        conn.write(JSON.stringify(msg) + "\n");
      }
    }
  }

  async _handleNewBlock(data) {
    if (this.blockchain.isSyncing) return;
    try {
      const block = Block.fromJSON(data);
      if (this.blockchain.getBlock(block.hash)) return;

      const result = await this.blockchain.addBlock(block);
      if (result.ok) {
        logger.info("Block accepted from swarm", { index: block.index });
        this.mempool.removeIncluded(block.transactions);
      } else if (result.error.includes("Chain link mismatch")) {
        this.triggerSync();
      }
    } catch (err) {
      logger.warn("Error handling gossip block", { error: err.message });
    }
  }

  async _handleNewTx(data) {
    if (this.blockchain.isSyncing) return;
    try {
      const tx = Transaction.fromJSON(data);
      if (this.mempool.has(tx.hash)) return;

      const result = await this.mempool.addTransaction(tx, (addr) =>
        this.blockchain.stateManager.getAccount(addr),
      );
      if (result.ok) logger.debug("Tx accepted from swarm", { hash: tx.hash });
    } catch (err) {
      logger.warn("Error handling gossip tx", { error: err.message });
    }
  }

  /**
   * Responder for SYNC_REQ
   */
  async _handleSyncReq(msg, socket) {
    const { fromIndex, count } = msg.data;
    const chainLength = this.blockchain.chain.length;
    const end = Math.min(fromIndex + count, chainLength);
    const blocks = [];

    for (let i = fromIndex; i < end; i++) {
      blocks.push(this.blockchain.chain[i].toJSON());
    }

    socket.write(
      JSON.stringify({
        type: "SYNC_RES",
        data: { fromIndex, blocks, totalHeight: chainLength - 1 },
      }) + "\n",
    );
  }

  /**
   * Orchestrate sync by rotating through peers
   */
  async triggerSync() {
    if (this.isSyncing) return;

    if (this.p2p.connections.size === 0) {
      logger.debug("No peers for sync");
      return;
    }

    this.isSyncing = true;
    logger.info("Starting sync via Hyperswarm");

    try {
      const peers = Array.from(this.p2p.connections);

      for (const socket of peers) {
        if (socket.destroyed) continue;

        let currentHeight = this.blockchain.getHeight();
        let targetHeight = currentHeight + 1;

        try {
          while (currentHeight < targetHeight) {
            const responsePromise = new Promise((resolve) => {
              const handler = (data) => {
                socket.removeListener("sync_response", handler);
                resolve(data);
              };
              socket.on("sync_response", handler);

              // Send request
              socket.write(
                JSON.stringify({
                  type: "SYNC_REQ",
                  data: { fromIndex: currentHeight + 1, count: 50 },
                }) + "\n",
              );

              // Timeout for response - reduced for more responsive recovery
              setTimeout(() => {
                socket.removeListener("sync_response", handler);
                resolve(null);
              }, 5000);
            });

            const response = await responsePromise;
            if (!response || !response.blocks || response.blocks.length === 0)
              break;

            targetHeight = response.totalHeight;
            const incomingBlocks = response.blocks.map((b) =>
              Block.fromJSON(b),
            );
            const replaced =
              await this.blockchain.resolveConflict(incomingBlocks);

            if (!replaced) break;

            currentHeight = this.blockchain.getHeight();
            const progress = ((currentHeight / targetHeight) * 100).toFixed(2);
            if (currentHeight % 100 === 0 || currentHeight === targetHeight) {
              logger.info(
                `Sync Progress: ${progress}% (${currentHeight}/${targetHeight})`,
              );
            }
          }
        } catch (err) {
          logger.warn(`Sync failed with peer: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error("Sync process error", { error: err.message });
    } finally {
      this.isSyncing = false;
      logger.info("Sync finished", { height: this.blockchain.getHeight() });
    }
  }
}
