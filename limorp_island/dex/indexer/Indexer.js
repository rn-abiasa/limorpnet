import { Level } from "level";
import fs from "fs";
import path from "path";

export class DEXIndexer {
  constructor(dataDir, callRpc) {
    this.dataDir = dataDir;
    this.callRpc = callRpc;
    this.db = null;
    this.lastIndexedBlock = -1;
    this.isSyncing = false;
    this.onEvent = null; // Callback for live updates
  }

  async open() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.db = new Level(this.dataDir, { valueEncoding: "json" });
    await this.db.open();

    try {
      const stored = await this.db.get("meta:lastBlock");
      this.lastIndexedBlock = parseInt(stored);
    } catch (e) {
      this.lastIndexedBlock = -1;
    }
    console.log(
      `[DEX Indexer] Opened at ${this.dataDir}. Last indexed: ${this.lastIndexedBlock}`,
    );
  }

  async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const nodeInfo = await this.callRpc("getNodeInfo");
      if (!nodeInfo) return;

      const currentHeight = nodeInfo.height;
      if (currentHeight <= this.lastIndexedBlock) return;

      console.log(
        `[DEX Indexer] Syncing from ${this.lastIndexedBlock + 1} to ${currentHeight}`,
      );

      for (let i = this.lastIndexedBlock + 1; i <= currentHeight; i++) {
        const block = await this.callRpc("getBlock", [i]);
        if (block) {
          await this._indexBlock(block);
          this.lastIndexedBlock = i;
          await this.db.put("meta:lastBlock", i);
        }
      }
    } catch (error) {
      console.error("[DEX Indexer] Sync Error:", error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  async _indexBlock(block) {
    const events = await this.callRpc("getEvents", { blockIndex: block.index });
    if (!events || events.length === 0) return;

    for (const event of events) {
      if (event.event === "PairCreated") {
        await this._handlePairCreated(event, block);
      } else if (event.event === "Sync") {
        await this._handleSync(event, block);
      } else if (event.event === "Swap") {
        await this._handleSwap(event, block);
      }

      if (this.onEvent) this.onEvent(event);
    }
  }

  async _handlePairCreated(event, block) {
    const { token0, token1, pair, pairIndex } = event.data;
    const pairData = {
      address: pair,
      token0,
      token1,
      pairIndex,
      createdAt: block.timestamp,
      reserves: { reserve0: "0", reserve1: "0" },
    };
    await this.db.put(`pair:${pair}`, pairData);
    await this.db.put(`pairIcons:${pair}`, { token0, token1 });
    console.log(`[DEX Indexer] New Pair: ${token0}/${token1} at ${pair}`);
  }

  async _handleSync(event, block) {
    const pairAddress = event.contract;
    const { reserve0, reserve1 } = event.data;

    try {
      const pairData = await this.db.get(`pair:${pairAddress}`);
      pairData.reserves = { reserve0, reserve1 };
      pairData.lastUpdate = block.timestamp;
      await this.db.put(`pair:${pairAddress}`, pairData);

      // Update price history (OHLCV)
      await this._updateOHLCV(pairAddress, reserve0, reserve1, block.timestamp);
    } catch (e) {
      // Pair might not be indexed yet if it's an external pair
    }
  }

  async _handleSwap(event, block) {
    const pairAddress = event.contract;
    const { sender, amount0In, amount1In, amount0Out, amount1Out, to } =
      event.data;

    const swapData = {
      txHash: event.txHash,
      pair: pairAddress,
      sender,
      to,
      amounts: { amount0In, amount1In, amount0Out, amount1Out },
      timestamp: block.timestamp,
    };

    // Index by pair
    await this.db.put(
      `swap:${pairAddress}:${block.timestamp}:${event.txHash}`,
      swapData,
    );

    // Update volume stats (optional)
    console.log(
      `[DEX Indexer] Swap on ${pairAddress}: ${amount0In || amount1In} -> ${amount1Out || amount0Out}`,
    );
  }

  async _updateOHLCV(pair, reserve0, reserve1, timestamp) {
    // Basic Price calculation (price of token0 in token1)
    const r0 = BigInt(reserve0);
    const r1 = BigInt(reserve1);
    if (r0 === 0n || r1 === 0n) return;

    // Scale for precision (e.g., 1e18)
    const price = (r1 * 1000000n) / r0; // Simple ratio for now

    const timeSlice = Math.floor(timestamp / 3600000) * 3600000; // Hourly
    const key = `ohlcv:${pair}:${timeSlice}`;

    let candle;
    try {
      candle = await this.db.get(key);
      candle.high =
        price > BigInt(candle.high) ? price.toString() : candle.high;
      candle.low = price < BigInt(candle.low) ? price.toString() : candle.low;
      candle.close = price.toString();
    } catch (e) {
      candle = {
        open: price.toString(),
        high: price.toString(),
        low: price.toString(),
        close: price.toString(),
        timestamp: timeSlice,
      };
    }
    await this.db.put(key, candle);
  }

  async getPairs() {
    const pairs = [];
    for await (const [key, value] of this.db.iterator({
      gte: "pair:",
      lte: "pair:\xFF",
    })) {
      pairs.push(value);
    }
    return pairs;
  }

  async getPriceHistory(pair) {
    const history = [];
    for await (const [key, value] of this.db.iterator({
      gte: `ohlcv:${pair}:`,
      lte: `ohlcv:${pair}:\xFF`,
      reverse: true,
      limit: 100,
    })) {
      history.push(value);
    }
    return history.reverse();
  }
}
