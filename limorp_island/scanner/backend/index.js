import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import axios from "axios";
import cors from "cors";
import path from "path";
import WebSocket from "ws";
import "dotenv/config";

import { Indexer } from "./indexer.js";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:3000";
const WS_RPC_URL = RPC_URL.replace("http", "ws");
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(process.cwd(), "data_indexer");

// Helper to call RPC
const callRpc = async (method, params = []) => {
  try {
    const response = await axios.post(RPC_URL, {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    });
    return response.data.result;
  } catch (error) {
    console.error(`RPC Error (${method}):`, error.message);
    return null;
  }
};

const indexer = new Indexer(DATA_DIR, callRpc);
await indexer.open();

// Separate background sync loop
const startIndexer = async () => {
  while (true) {
    try {
      await indexer.sync();
    } catch (e) {
      console.error("[Indexer] Loop error:", e.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
};
startIndexer();

let cachedPayload = null;

// Function to broadcast dashboard updates
const updateDashboard = async () => {
  try {
    const nodeInfo = await callRpc("getNodeInfo");
    if (!nodeInfo) return;

    const height = nodeInfo.height;
    // Fetch up to 14 blocks for a decent trend line
    const start = Math.max(0, height - 13);

    const blockPromises = [];
    for (let i = height; i >= start; i--) {
      blockPromises.push(callRpc("getBlock", [i]));
    }

    const blocks = (await Promise.all(blockPromises)).filter(Boolean);
    blocks.sort((a, b) => b.index - a.index);

    const txs = [];
    for (const b of blocks.slice(0, 5)) {
      if (b.transactions) {
        txs.push(
          ...b.transactions.map((tx) => {
            let method = null;
            if (tx.type === "CALL" && tx.data) {
              try {
                const parsed = JSON.parse(tx.data);
                method = parsed.method;
              } catch (e) {
                // Ignore parsing errors
              }
            }
            return {
              ...tx,
              method,
              blockHeight: b.index,
              timestamp: b.timestamp,
            };
          }),
        );
      }
    }

    // Map blocks to chart data [ oldest -> newest ]
    const txTrend = [...blocks].reverse().map((b) => ({
      block: b.index,
      txs: b.transactions ? b.transactions.length : 0,
    }));

    cachedPayload = {
      stats: {
        height: nodeInfo.height,
        peers: nodeInfo.peers,
        mempool: nodeInfo.mempool,
        totalSupply: nodeInfo.totalSupply,
        isSyncing: nodeInfo.isSyncing,
        txTrend,
      },
      latestBlocks: blocks.slice(0, 10), // Only send 10 blocks to frontend tables
      latestTransactions: txs.slice(0, 10),
    };

    io.emit("dashboard-update", cachedPayload);
    console.log(`[Backend] Dashboard Pushed: height=${height}`);
  } catch (error) {
    console.error("[Backend] Update error:", error.message);
  }
};

// WebSocket connection to Node for Real-Time Push
const connectToNodeWS = () => {
  const ws = new WebSocket(WS_RPC_URL);

  ws.on("open", () => {
    console.log("[WS] Connected to Node RPC");
    // Subscribe to new blocks
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "lmr_subscribe",
        params: ["newHeads"],
      }),
    );
    // Subscribe to new pending txs
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "lmr_subscribe",
        params: ["newPendingTransactions"],
      }),
    );
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.method === "lmr_subscription") {
        console.log(`[WS] Event received: ${msg.params.subscription}`);
        // Immediately update dashboard on new block or tx
        updateDashboard();
      }
    } catch (e) {
      console.error("[WS] Message error:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("[WS] Disconnected, retrying in 5s...");
    setTimeout(connectToNodeWS, 5000);
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err.message);
  });
};

connectToNodeWS();

// Helper poll for stats only (less frequent)
setInterval(updateDashboard, 15000);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send initial data immediately from cache if available
  if (cachedPayload) {
    socket.emit("dashboard-update", cachedPayload);
  } else {
    updateDashboard();
  }

  // Handle specific block requests
  socket.on("get-block", async (height) => {
    const block = await callRpc("getBlock", [parseInt(height)]);
    socket.emit("block-details", block);
  });

  // Handle paginated blocks request
  socket.on("get-pagination-blocks", async ({ page = 1, limit = 25 }) => {
    try {
      const nodeInfo = await callRpc("getNodeInfo");
      if (!nodeInfo) return;

      const totalHeight = nodeInfo.height;
      const start = Math.max(0, totalHeight - (page - 1) * limit);
      const end = Math.max(0, start - limit + 1);

      const blockPromises = [];
      for (let i = start; i >= end; i--) {
        blockPromises.push(callRpc("getBlock", [i]));
      }

      const blocks = (await Promise.all(blockPromises)).filter(Boolean);

      socket.emit("pagination-blocks-res", {
        blocks,
        total: totalHeight + 1,
        page,
        limit,
      });
    } catch (error) {
      console.error("[Backend] Pagination error:", error.message);
    }
  });

  // Handle paginated transactions request
  socket.on("get-pagination-txs", async ({ page = 1, limit = 25 }) => {
    try {
      const nodeInfo = await callRpc("getNodeInfo");
      if (!nodeInfo) return;

      const latestHeight = nodeInfo.height;
      const txs = [];
      let currentHeight = latestHeight;
      let skipped = 0;
      const targetSkip = (page - 1) * limit;

      // Scan backwards to find transactions
      while (txs.length < limit && currentHeight >= 0) {
        const block = await callRpc("getBlock", [currentHeight]);
        if (block && block.transactions && block.transactions.length > 0) {
          const blockTxs = block.transactions
            .map((tx) => {
              let method = null;
              if (tx.type === "CALL" && tx.data) {
                try {
                  const parsed = JSON.parse(tx.data);
                  method = parsed.method;
                } catch (e) {
                  // Ignore
                }
              }
              return {
                ...(tx.toJSON ? tx.toJSON() : tx),
                method,
                blockHeight: block.index,
                timestamp: block.timestamp,
              };
            })
            .reverse();

          for (const tx of blockTxs) {
            if (skipped < targetSkip) {
              skipped++;
              continue;
            }
            txs.push(tx);
            if (txs.length >= limit) break;
          }
        }
        currentHeight--;
        // Limit scan depth to avoid hanging
        if (latestHeight - currentHeight > 500) break;
      }

      socket.emit("pagination-txs-res", {
        transactions: txs,
        page,
        limit,
        hasMore: currentHeight >= 0,
      });
    } catch (error) {
      console.error("[Backend] Tx Pagination error:", error.message);
    }
  });

  // Handle specific address requests
  socket.on("get-address-info", async (address) => {
    const normalizedAddress = address.toLowerCase();
    console.log(`[Backend] Fetching data for address: ${normalizedAddress}`);
    try {
      const [account, history, events] = await Promise.all([
        callRpc("getAccount", [normalizedAddress]),
        indexer.getAddressHistory(normalizedAddress),
        indexer.getAddressEvents(normalizedAddress),
      ]);
      console.log(
        `[Backend] Results for ${normalizedAddress}: Account=${!!account}, History=${history?.length || 0}, Events=${events?.length || 0}`,
      );
      socket.emit("address-details", {
        address: normalizedAddress,
        account,
        history,
        events,
      });
    } catch (error) {
      console.error(`[Backend] Error fetching address info:`, error.message);
    }
  });

  // Handle specific transaction requests
  socket.on("get-tx-info", async (hash) => {
    try {
      const [tx, receipt] = await Promise.all([
        callRpc("getTransaction", [hash]),
        callRpc("getTransactionReceipt", [hash]),
      ]);
      socket.emit("tx-details", { tx, receipt });
    } catch (error) {
      console.error(`[Backend] Error fetching tx info:`, error.message);
    }
  });

  // Handle tokens gallery request
  socket.on("get-tokens", async () => {
    try {
      const tokens = await indexer.getTokens();
      socket.emit("tokens-res", tokens);
    } catch (error) {
      console.error("[Backend] Error fetching tokens:", error.message);
    }
  });

  // NEW: Manual trigger to re-index from scratch
  socket.on("super-resync", async () => {
    console.log("🚨 Super Resync triggered by client! Resetting index to 0...");
    indexer.lastIndexedBlock = -1;
    await indexer.sync();
    const tokens = await indexer.getTokens();
    socket.emit("tokens-res", tokens);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Scanner backend listening on port ${PORT}`);
  console.log(`Connected to RPC: ${RPC_URL}`);
});
