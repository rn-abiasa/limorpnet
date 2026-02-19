import Hyperswarm from "hyperswarm";
import b4a from "b4a";
import crypto from "crypto";
import { createLogger } from "../utils/logger.js";
import { MessageHandler } from "./MessageHandler.js";

const logger = createLogger("P2PServer");

export const MSG_TOPICS = {
  BLOCKS: "/limorp/blocks/1.0.0",
  TXS: "/limorp/txs/1.0.0",
};

export class P2PServer {
  constructor({ blockchain, mempool, port = 6001 }) {
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.port = port;
    this.swarm = null;
    this.handler = new MessageHandler({ blockchain, mempool, p2p: this });
    this.connections = new Set();
  }

  async start() {
    this.swarm = new Hyperswarm();

    // Use a fixed topic for the Limorp network
    const topic = crypto
      .createHash("sha256")
      .update("limorp-production-network")
      .digest();

    this.swarm.on("connection", (socket, info) => {
      const peerId = b4a.toString(socket.remotePublicKey, "hex").slice(0, 10);
      logger.info(`✅ Connected to peer: ${peerId}`, {
        initiator: info.client,
        address: socket.remoteAddress,
      });

      this.connections.add(socket);
      this.handler.handleSocket(socket);

      socket.on("error", (err) => {
        logger.debug(`Socket error from ${peerId}: ${err.message}`);
      });

      socket.on("close", () => {
        logger.info(`❌ Disconnected from peer: ${peerId}`);
        this.connections.delete(socket);
      });
    });

    const discovery = this.swarm.join(topic, { server: true, client: true });

    // Also join as client to ensure we find others
    await discovery.flushed();

    logger.info("P2P Node started (Hyperswarm)", {
      topic: "limorp-production-network",
      publicKey: b4a.toString(this.swarm.keyPair.publicKey, "hex"),
    });
  }

  /**
   * Interface for BlockProducer to trigger sync
   */
  requestSync(targetHeight) {
    logger.info(`Sync requested for height: ${targetHeight}`);
    this.handler.triggerSync().catch((err) => {
      logger.error("Failed to trigger sync", { error: err.message });
    });
  }

  /**
   * Hyperswarm flooding gossip
   */
  broadcast(topic, data) {
    if (!this.swarm) return;

    const packet = JSON.stringify(
      {
        type: "GOSSIP",
        topic,
        data,
        timestamp: Date.now(),
      },
      (k, v) => (typeof v === "bigint" ? v.toString() : v),
    );

    let count = 0;
    for (const socket of this.connections) {
      if (!socket.destroyed) {
        socket.write(packet + "\n"); // Newline delimited JSON
        count++;
      }
    }

    logger.debug(`Broadcasted ${topic} to ${count} peers`);
  }

  getPeerCount() {
    return this.connections.size;
  }

  async stop() {
    if (this.swarm) {
      await this.swarm.destroy();
      logger.info("P2P Node stopped");
    }
  }
}
