import { createServer } from "http";
import { createLogger } from "../utils/logger.js";
import { Transaction, TX_TYPE } from "../core/transaction.js";
import { calculateBlockReward } from "../utils/rewards.js";

const logger = createLogger("RpcServer");

export class RpcServer {
  /**
   * @param {object} params
   * @param {import('../core/Blockchain.js').Blockchain} params.blockchain
   * @param {import('../core/Mempool.js').Mempool} params.mempool
   * @param {import('../network/P2PServer.js').P2PServer} params.p2p
   * @param {number} params.port
   */
  constructor({ blockchain, mempool, p2p, port = 3000 }) {
    this.blockchain = blockchain;
    this.mempool = mempool;
    this.p2p = p2p;
    this.port = port;
    this.server = null;
  }

  start() {
    this.server = createServer(async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405);
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const rpc = JSON.parse(body);
          const result = await this._dispatch(rpc);
          res.writeHead(200);
          res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        } catch (err) {
          logger.warn("RPC error", { error: err.message });
          res.writeHead(400);
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32600, message: err.message },
            }),
          );
        }
      });
    });

    this.server.listen(this.port, () => {
      logger.info("RPC server started", { port: this.port });
    });
  }

  async _dispatch({ method, params = [] }) {
    switch (method) {
      case "getBalance":
        return this._getBalance(params[0]);

      case "getAccount":
        return this._getAccount(params[0]);

      case "getNonce":
        return this._getNonce(params[0]);

      case "getCode":
        return this._getCode(params[0]);

      case "sendTransaction":
        return this._sendTransaction(params[0]);

      case "getTransaction":
        return this._getTransaction(params[0]);

      case "getBlock":
        return this._getBlock(params[0]);

      case "getLatestBlock":
        return this.blockchain.getLatestBlock()?.toJSON() ?? null;

      case "getHeight":
        return this.blockchain.getHeight();

      case "getValidators":
        return this._getValidators();

      case "getMempoolTxs":
        return this.mempool.all().map((tx) => tx.toJSON());

      case "getMempoolSize":
        return this.mempool.size();

      case "getPeerCount":
        return this.p2p.getPeerCount();

      case "getAddressHistory":
        return this._getAddressHistory(params[0]);

      case "recalculateTotalSupply":
        return (
          await this.blockchain.stateManager.recalculateTotalSupply()
        ).toString();

      case "getNodeInfo":
        return this._getNodeInfo();

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async _getBalance(address) {
    if (!address) throw new Error("address required");
    const account = await this.blockchain.stateManager.getAccount(
      address.toLowerCase(),
    );
    return account ? account.balance.toString() : "0";
  }

  async _getAccount(address) {
    if (!address) throw new Error("address required");
    const account = await this.blockchain.stateManager.getAccount(
      address.toLowerCase(),
    );
    if (!account) return null;
    return {
      balance: account.balance.toString(),
      nonce: account.nonce,
      stake: account.stake.toString(),
      mined: (account.mined || 0n).toString(),
      hasCode: !!account.code,
    };
  }

  async _getNonce(address) {
    if (!address) throw new Error("address required");
    const account = await this.blockchain.stateManager.getAccount(
      address.toLowerCase(),
    );
    return account ? account.nonce : 0;
  }

  async _getCode(address) {
    if (!address) throw new Error("address required");
    const account = await this.blockchain.stateManager.getAccount(
      address.toLowerCase(),
    );
    return account ? account.code || "0x" : "0x";
  }

  async _sendTransaction(txData) {
    if (!txData) throw new Error("txData required");

    const tx = Transaction.fromJSON({
      ...txData,
      amount: txData.amount?.toString() ?? "0",
      fee: txData.fee?.toString() ?? "0",
    });

    const result = await this.mempool.addTransaction(tx, (addr) =>
      this.blockchain.stateManager.getAccount(addr),
    );

    if (!result.ok) throw new Error(result.error);

    // Broadcast to peers
    const { MSG } = await import("../network/P2PServer.js");
    this.p2p.broadcast(MSG.NEW_TX, tx.toJSON());

    return { hash: tx.hash };
  }

  async _getTransaction(hash) {
    if (!hash) throw new Error("hash required");

    // Check mempool first
    const mempoolTx = this.mempool.get(hash);
    if (mempoolTx) return { ...mempoolTx.toJSON(), status: "pending" };

    // Search in chain
    for (const block of this.blockchain.chain) {
      const tx = block.transactions.find((t) => (t.hash ?? t) === hash);
      if (tx)
        return {
          ...(tx.toJSON ? tx.toJSON() : tx),
          status: "confirmed",
          blockIndex: block.index,
        };
    }

    return null;
  }

  _getBlock(indexOrHash) {
    const block = this.blockchain.getBlock(
      isNaN(indexOrHash) ? indexOrHash : parseInt(indexOrHash),
    );
    if (!block) return null;

    const json = block.toJSON();
    json.reward = calculateBlockReward(block.index).toString();
    return json;
  }

  async _getValidators() {
    const validators = await this.blockchain.stateManager.getValidators();
    return validators.map((v) => ({
      address: v.address,
      stake: v.stake.toString(),
    }));
  }

  async _getNodeInfo() {
    return {
      chainId: this.blockchain.genesis.chainId,
      height: this.blockchain.getHeight(),
      peers: this.p2p.getPeerCount(),
      mempool: this.mempool.size(),
      isSyncing: this.blockchain.isSyncing,
      totalSupply: (
        await this.blockchain.stateManager.getTotalSupply()
      ).toString(),
      timestamp: Date.now(),
    };
  }

  async _getAddressHistory(address) {
    if (!address) throw new Error("address required");
    const targetAddr = address.toLowerCase();

    const history = [];
    const maxScan = 5000; // Limit scan to improve performance
    const chainLength = this.blockchain.chain.length;
    const startIdx = Math.max(0, chainLength - maxScan);

    // Scan chain from newest to oldest
    for (let i = chainLength - 1; i >= startIdx; i--) {
      const block = this.blockchain.chain[i];
      for (const tx of block.transactions) {
        if (
          tx.from?.toLowerCase() === targetAddr ||
          tx.to?.toLowerCase() === targetAddr
        ) {
          history.push({
            ...(tx.toJSON ? tx.toJSON() : tx),
            status: "confirmed",
            blockIndex: block.index,
            timestamp: block.timestamp,
          });
        }
      }
      // Avoid blocking the event loop if the scan is large
      if (i % 500 === 0) await new Promise((resolve) => setImmediate(resolve));
    }
    return history;
  }
}
