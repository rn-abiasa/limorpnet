import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import axios from "axios";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const RPC_URL = process.env.RPC_URL || "http://localhost:3000";
const PORT = process.env.PORT || 4000;

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

let cachedPayload = null;
let isPolling = false;

// Polling for real-time updates
const pollBlockchainData = async () => {
  if (isPolling) return;
  isPolling = true;

  try {
    const nodeInfo = await callRpc("getNodeInfo");
    if (!nodeInfo) {
      isPolling = false;
      return;
    }

    const height = nodeInfo.height;
    const start = Math.max(0, height - 9);

    // Fetch individual blocks in parallel
    const blockPromises = [];
    for (let i = height; i >= start; i--) {
      blockPromises.push(callRpc("getBlock", [i]));
    }

    const blocks = (await Promise.all(blockPromises)).filter(Boolean);

    // Extract latest transactions from latest blocks
    const txs = [];
    for (const b of blocks.slice(0, 5)) {
      if (b.transactions) {
        txs.push(
          ...b.transactions.map((tx) => ({
            ...tx,
            blockHeight: b.index,
            timestamp: b.timestamp,
          })),
        );
      }
    }

    cachedPayload = {
      stats: {
        height: nodeInfo.height,
        peers: nodeInfo.peers,
        mempool: nodeInfo.mempool,
        totalSupply: nodeInfo.totalSupply,
        isSyncing: nodeInfo.isSyncing,
      },
      latestBlocks: blocks,
      latestTransactions: txs.slice(0, 10),
    };

    io.emit("dashboard-update", cachedPayload);
  } catch (error) {
    console.error("Polling Error:", error.message);
  } finally {
    isPolling = false;
  }
};

// Start polling every 3 seconds
setInterval(pollBlockchainData, 3000);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send initial data immediately from cache if available
  if (cachedPayload) {
    socket.emit("dashboard-update", cachedPayload);
  } else {
    pollBlockchainData();
  }

  // Handle specific block requests
  socket.on("get-block", async (height) => {
    const block = await callRpc("getBlock", [parseInt(height)]);
    socket.emit("block-details", block);
  });

  // Handle specific address requests
  socket.on("get-address-info", async (address) => {
    const normalizedAddress = address.toLowerCase();
    console.log(`[Backend] Fetching data for address: ${normalizedAddress}`);
    try {
      const [account, history] = await Promise.all([
        callRpc("getAccount", [normalizedAddress]),
        callRpc("getAddressHistory", [normalizedAddress]),
      ]);
      console.log(
        `[Backend] Results for ${normalizedAddress}: Account=${!!account}, History=${history?.length || 0}`,
      );
      socket.emit("address-details", {
        address: normalizedAddress,
        account,
        history,
      });
    } catch (error) {
      console.error(`[Backend] Error fetching address info:`, error.message);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Scanner backend listening on port ${PORT}`);
  console.log(`Connected to RPC: ${RPC_URL}`);
});
