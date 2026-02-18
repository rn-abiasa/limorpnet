import { WebSocketServer, WebSocket } from "ws";
import { createLogger } from "../utils/logger.js";
import { MessageHandler } from "./MessageHandler.js";
import { Bonjour } from "bonjour-service";
import os from "os";

const logger = createLogger("P2PServer");
const bonjour = new Bonjour();

export const MSG = {
  NEW_BLOCK: "NEW_BLOCK",
  NEW_TX: "NEW_TX",
  REQUEST_CHAIN: "REQUEST_CHAIN",
  RESPONSE_CHAIN: "RESPONSE_CHAIN",
  NEW_PEER: "NEW_PEER",
  PING: "PING",
  PONG: "PONG",
};

export class P2PServer {
  /**
   * @param {object} params
   * @param {import('../core/Blockchain.js').Blockchain} params.blockchain
   * @param {import('../core/Mempool.js').Mempool} params.mempool
   * @param {number} params.port
   */
  constructor({ blockchain, mempool, port = 6001 }) {
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.port = port;
    this.peers = new Map(); // url -> WebSocket
    this.wss = null;
    this.handler = new MessageHandler({ blockchain, mempool, p2p: this });
    this.localIp = this._getLocalIp();
  }

  _getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    return "127.0.0.1";
  }

  start() {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws, req) => {
      const ip = req.socket.remoteAddress;
      logger.info("Peer connected", { ip });
      this._initSocket(ws);
      this._sendChainRequest(ws);
    });

    logger.info("P2P server started", { port: this.port, ip: this.localIp });
    this._startDiscovery();
  }

  _startDiscovery() {
    // 1. Publish ourselves
    bonjour.publish({
      name: `Limorp-${this.port}-${Math.random().toString(36).slice(2, 7)}`,
      type: "limorp",
      port: this.port,
      txt: { chainId: this.blockchain.genesis.chainId },
    });

    // 2. Browse for others
    const browser = bonjour.find({ type: "limorp" });
    browser.on("up", (service) => {
      const url = `ws://${service.referer.address}:${service.port}`;
      if (url !== `ws://${this.localIp}:${this.port}` && !this.peers.has(url)) {
        logger.info("LAN peer discovered via mDNS", { url });
        this.connectToPeer(url);
      }
    });

    logger.info("LAN Discovery (mDNS) active");
  }

  /**
   * Connect to a peer by WebSocket URL
   */
  connectToPeer(url) {
    if (this.peers.has(url)) return;

    const ws = new WebSocket(url);

    ws.on("open", () => {
      logger.info("Connected to peer", { url });
      this.peers.set(url, ws);
      this._initSocket(ws, url);
      this._sendChainRequest(ws);
      // Announce ourselves to the peer using real LAN IP
      this._send(ws, MSG.NEW_PEER, {
        url: `ws://${this.localIp}:${this.port}`,
      });
    });

    ws.on("error", (err) => {
      logger.warn("Peer connection error", { url, error: err.message });
      this.peers.delete(url);
    });
  }

  _initSocket(ws, url = null) {
    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handler.handle(msg, ws);
      } catch (err) {
        logger.warn("Invalid message received", { error: err.message });
      }
    });

    ws.on("close", () => {
      if (url) {
        logger.info("Peer disconnected", { url });
        this.peers.delete(url);
        // Attempt reconnect after 10s
        setTimeout(() => this.connectToPeer(url), 10_000);
      }
    });

    ws.on("error", (err) => {
      logger.warn("Socket error", { error: err.message });
    });

    // Heartbeat
    ws._pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        this._send(ws, MSG.PING, {});
      }
    }, 30_000);

    ws.on("close", () => clearInterval(ws._pingInterval));
  }

  /**
   * Broadcast a message to all connected peers
   */
  broadcast(type, data, excludeWs = null) {
    const msg = JSON.stringify({ type, data });

    // Broadcast to outgoing peers
    for (const [, ws] of this.peers) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }

    // Broadcast to incoming peers (wss clients)
    if (this.wss) {
      for (const ws of this.wss.clients) {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    }
  }

  _send(ws, type, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  }

  _sendChainRequest(ws) {
    this._send(ws, MSG.REQUEST_CHAIN, {});
  }

  /**
   * Connect to initial peers from env
   */
  connectToInitialPeers() {
    const peers = (process.env.PEERS || "").split(",").filter(Boolean);
    for (const url of peers) {
      this.connectToPeer(url.trim());
    }
  }

  getPeerCount() {
    return this.peers.size + (this.wss ? this.wss.clients.size : 0);
  }
}
