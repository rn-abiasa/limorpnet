import { Level } from "level";
import path from "path";
import fs from "fs";

/**
 * Indexer for Limorp Explorer
 * Stores blocks, transactions, and events in a local LevelDB
 */
export class Indexer {
  constructor(dataDir, callRpc) {
    this.dataDir = dataDir;
    this.callRpc = callRpc;
    this.db = null;
    this.lastIndexedBlock = -1;
    this.isSyncing = false;
  }

  async open() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.db = new Level(this.dataDir, { valueEncoding: "json" });
    await this.db.open();

    try {
      this.lastIndexedBlock = await this.db.get("meta:lastBlock");
    } catch (e) {
      this.lastIndexedBlock = -1;
    }
    console.log(
      `[Indexer] Opened at ${this.dataDir}. Last indexed: ${this.lastIndexedBlock}`,
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
        `[Indexer] Syncing from ${this.lastIndexedBlock + 1} to ${currentHeight}`,
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
      console.error("[Indexer] Sync Error:", error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  async _indexBlock(block) {
    const batch = [];

    // Index Transactions
    if (block.transactions) {
      for (const tx of block.transactions) {
        const txData = {
          ...tx,
          blockIndex: block.index,
          timestamp: block.timestamp,
          status: "confirmed",
        };

        // Store by hash
        batch.push({ type: "put", key: `tx:hash:${tx.hash}`, value: txData });

        // Index by address (from and to)
        if (tx.from) {
          const key = `addr:tx:${tx.from.toLowerCase()}:${block.timestamp}:${tx.hash}`;
          batch.push({ type: "put", key, value: txData });
        }
        if (tx.to) {
          const key = `addr:tx:${tx.to.toLowerCase()}:${block.timestamp}:${tx.hash}`;
          batch.push({ type: "put", key, value: txData });
        }
      }
    }

    // Index Events (if available)
    // We poll the node for events specifically for this block
    const blockEvents =
      (await this.callRpc("getEvents", { blockIndex: block.index })) || [];

    for (const event of blockEvents) {
      const key = `addr:event:${event.contract.toLowerCase()}:${block.timestamp}`;
      batch.push({ type: "put", key, value: event });

      // If it's a Transfer event, we also index it for the from/to addresses
      if (event.event === "Transfer" && event.data) {
        const { from, to } = event.data;
        if (from) {
          batch.push({
            type: "put",
            key: `addr:event:${from.toLowerCase()}:${block.timestamp}`,
            value: event,
          });
        }
        if (to) {
          batch.push({
            type: "put",
            key: `addr:event:${to.toLowerCase()}:${block.timestamp}`,
            value: event,
          });
        }
      }
    }

    await this.db.batch(batch);
  }

  async getAddressHistory(address) {
    const history = [];
    const prefix = `addr:tx:${address.toLowerCase()}:`;

    for await (const [key, value] of this.db.iterator({
      gte: prefix,
      lte: prefix + "\xFF",
      reverse: true,
    })) {
      history.push(value);
      if (history.length >= 100) break; // Limit to 100 most recent
    }
    return history;
  }

  async getAddressEvents(address) {
    const events = [];
    const prefix = `addr:event:${address.toLowerCase()}:`;

    for await (const [key, value] of this.db.iterator({
      gte: prefix,
      lte: prefix + "\xFF",
      reverse: true,
    })) {
      events.push(value);
    }
    return events;
  }
}
