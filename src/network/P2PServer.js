import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { webSockets } from "@libp2p/websockets";
import { mplex } from "@libp2p/mplex";
import { noise } from "@libp2p/noise";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { mdns } from "@libp2p/mdns";
import { bootstrap } from "@libp2p/bootstrap";
import { kadDHT } from "@libp2p/kad-dht";
import { identify } from "@libp2p/identify";
import { ping } from "@libp2p/ping";
import { multiaddr } from "@multiformats/multiaddr";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import { createLogger } from "../utils/logger.js";
import { MessageHandler } from "./MessageHandler.js";

const logger = createLogger("P2PServer");

export const MSG_TOPICS = {
  BLOCKS: "/limorp/blocks/1.0.0",
  TXS: "/limorp/txs/1.0.0",
};

export class P2PServer {
  constructor({ blockchain, mempool, port = 6001, bootstrapPeers = [] }) {
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.port = port;
    this.bootstrapPeers = bootstrapPeers;
    this.node = null;
    this.handler = new MessageHandler({ blockchain, mempool, p2p: this });
    this.dialHistory = new Map(); // Track dial attempts for backoff
    this.startTime = Date.now();
  }

  async start() {
    const peerDiscovery = [
      mdns({
        interval: 20e3,
      }),
    ];

    if (this.bootstrapPeers && this.bootstrapPeers.length > 0) {
      peerDiscovery.push(
        bootstrap({
          list: this.bootstrapPeers,
        }),
      );
    }

    this.node = await createLibp2p({
      addresses: {
        listen: [
          `/ip4/0.0.0.0/tcp/${this.port}`,
          `/ip4/0.0.0.0/tcp/${this.port + 100}/ws`,
        ],
      },
      transports: [tcp(), webSockets()],
      streamMuxers: [mplex()],
      connectionEncryption: [noise()],
      peerDiscovery,
      services: {
        pubsub: gossipsub({
          allowPublishToZeroPeers: true,
          fallbackToFloodsub: true,
          emitSelf: false,
          maxInboundStreams: 1024,
          maxOutboundStreams: 1024,
        }),
        dht: kadDHT({
          protocol: "/limorp/lan/kad/1.0.0",
          clientMode: false,
          allowQueryWithZeroPeers: true,
        }),
        identify: identify(),
        ping: ping(),
      },
      connectionGater: {
        denyDialMultiaddr: async () => false,
      },
    });

    // Handle Discovery
    this.node.addEventListener("peer:discovery", (evt) => {
      const peer = evt.detail;
      const peerIdStr = peer.id.toString();
      logger.debug(`Discovered peer: ${peerIdStr}`);

      this._aggressiveDial(peer.id);
    });

    // Handle Connections
    this.node.addEventListener("peer:connect", (evt) => {
      const peerId = evt.detail;
      logger.info(`✅ Connected to peer: ${peerId.toString()}`);
      this.dialHistory.delete(peerId.toString()); // Reset backoff on success
    });

    this.node.addEventListener("peer:disconnect", (evt) => {
      const peerId = evt.detail;
      logger.info(`❌ Disconnected from peer: ${peerId.toString()}`);
    });

    // Setup PubSub Subscriptions
    this.node.services.pubsub.subscribe(MSG_TOPICS.BLOCKS);
    this.node.services.pubsub.subscribe(MSG_TOPICS.TXS);

    this.node.services.pubsub.addEventListener("message", async (evt) => {
      const { topic, data } = evt.detail;
      try {
        const msg = JSON.parse(uint8ArrayToString(data));

        if (topic === MSG_TOPICS.BLOCKS) {
          await this.handler._handleNewBlock(msg);
        } else if (topic === MSG_TOPICS.TXS) {
          await this.handler._handleNewTx(msg);
        }
      } catch (err) {
        logger.warn("P2P Message Error", { topic, error: err.message });
      }
    });

    // Setup Custom Protocols for Direct Sync
    this.node.handle("/limorp/sync/1.0.0", async ({ stream }) => {
      // Direct stream handler for chunked sync
      this.handler.handleSyncStream(stream);
    });

    await this.node.start();
    logger.info("P2P Node started (Libp2p)", {
      id: this.node.peerId.toString(),
      addresses: this.node.getMultiaddrs().map((ma) => ma.toString()),
    });

    // Initial connection to bootstrap peers
    for (const addr of this.bootstrapPeers) {
      this.connectToPeer(addr).catch((err) => {
        logger.debug(
          `Failed initial bootstrap connect to ${addr}: ${err.message}`,
        );
      });
    }
  }

  /**
   * Aggressive dialing with exponential backoff
   */
  async _aggressiveDial(peerId) {
    const idStr = peerId.toString();
    const history = this.dialHistory.get(idStr) || {
      attempts: 0,
      lastAttempt: 0,
    };

    // Check backoff (min 5s, max 60s)
    const backoff = Math.min(
      Math.pow(2, history.attempts) * 1000 + 5000,
      60000,
    );
    if (Date.now() - history.lastAttempt < backoff) return;

    try {
      history.attempts++;
      history.lastAttempt = Date.now();
      this.dialHistory.set(idStr, history);

      logger.debug(
        `Attempting to dial discovered peer: ${idStr} (Attempt ${history.attempts})`,
      );
      await this.node.dial(peerId);
    } catch (err) {
      logger.debug(`Dial failed for ${idStr}: ${err.message}`);
    }
  }

  /**
   * Manual connection to a peer
   */
  async connectToPeer(addr) {
    if (!this.node) return;
    try {
      const ma = multiaddr(addr);
      await this.node.dial(ma);
      logger.info(`Manually connected to peer: ${addr}`);
    } catch (err) {
      logger.warn(`Failed to connect to peer: ${addr}`, { error: err.message });
      throw err;
    }
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

  broadcast(topic, data) {
    if (!this.node) return;
    const msg = uint8ArrayFromString(JSON.stringify(data));
    this.node.services.pubsub.publish(topic, msg).catch((err) => {
      // Suppress "NoPeersSubscribedToTopic" warning during startup (first 2 mins)
      const isStartup = Date.now() - this.startTime < 120000;
      if (err.message.includes("NoPeersSubscribedToTopic") && isStartup) {
        return;
      }
      logger.warn("Broadcast error", { topic, error: err.message });
    });
  }

  getPeerCount() {
    return this.node ? this.node.getPeers().length : 0;
  }

  async stop() {
    if (this.node) {
      await this.node.stop();
      logger.info("P2P Node stopped");
    }
  }
}
