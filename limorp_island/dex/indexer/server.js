import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import axios from "axios";
import { DEXIndexer } from "./Indexer.js";
import "dotenv/config";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Enable CORS for Express
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  next();
});

const RPC_URL = process.env.RPC_URL || "http://localhost:3000";
const PORT = process.env.PORT || 4001;

const callRpc = async (method, params = []) => {
  try {
    const res = await axios.post(RPC_URL, {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    });
    return res.data.result;
  } catch (e) {
    return null;
  }
};

const indexer = new DEXIndexer("./db", callRpc);

// Broadcast events to all clients
indexer.onEvent = (event) => {
  console.log(`[Socket] Broadcasting event: ${event.event}`);
  io.emit("dex_event", event);
};

app.get("/pairs", async (req, res) => {
  res.json(await indexer.getPairs());
});

app.get("/history/:pair", async (req, res) => {
  res.json(await indexer.getPriceHistory(req.params.pair));
});

httpServer.listen(PORT, async () => {
  console.log(`[DEX Server] Running on port ${PORT}`);
  await indexer.open();

  // Start indexing loop
  setInterval(async () => {
    await indexer.sync();
  }, 5000);
});
