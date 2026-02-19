import { Level } from "level";
import path from "path";
import fs from "fs";
import { sha256, serialize } from "./utils/crypto.js";

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
      const stored = await this.db.get("meta:lastBlock");
      this.lastIndexedBlock = parseInt(stored);
      if (isNaN(this.lastIndexedBlock)) {
        console.warn(
          "[Indexer] ⚠️  Found NaN in DB for lastBlock, resetting to -1",
        );
        this.lastIndexedBlock = -1;
      }
    } catch (e) {
      this.lastIndexedBlock = -1;
    }
    console.log(
      `[Indexer] Opened at ${this.dataDir}. Last indexed: ${this.lastIndexedBlock}`,
    );

    // Test connectivity
    try {
      const info = await this.callRpc("getNodeInfo");
      if (info) {
        console.log(
          `[Indexer] ✅ Connected to RPC. Node Height: ${info.height}`,
        );
      } else {
        console.warn(
          "[Indexer] ⚠️  Warning: RPC returned empty info. Check node status.",
        );
      }
    } catch (e) {
      console.error(`[Indexer] ❌ RPC Connection Failed: ${e.message}`);
    }
  }

  async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const nodeInfo = await this.callRpc("getNodeInfo");
      if (!nodeInfo) return;

      const currentHeight = nodeInfo.height;
      if (currentHeight <= this.lastIndexedBlock) return;

      // Aggressive Diagnostic: If we haven't found any tokens, re-scan from absolute START once.
      const tokens = await this.getTokens();
      if (tokens.length === 0 && this.lastIndexedBlock > 0) {
        console.log(
          "[Indexer] 🚨 Diagnostic: No tokens found in DB. Resetting index to block 0 to capture historical DEPLOYs...",
        );
        this.lastIndexedBlock = -1; // Force start from 0
      }

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

    // Map receipts for quick access
    const receipts = block.receipts || [];
    const receiptMap = new Map(receipts.map((r) => [r.txHash, r]));

    // Index Transactions
    if (block.transactions) {
      console.log(
        `[Indexer] Block #${block.index} Transactions: ${block.transactions.length}, Types: ${block.transactions.map((t) => t.type).join(", ")}`,
      );
      for (const tx of block.transactions) {
        const receipt = receiptMap.get(tx.hash);
        // Fallback: If no receipt exists (legacy blocks), assume success
        // If receipt exists, follow the status (1=success, 0=failed)
        const txStatus = receipt
          ? receipt.status === 1
            ? "success"
            : "failed"
          : "success";

        const txData = {
          ...tx,
          blockIndex: block.index,
          timestamp: block.timestamp,
          status: txStatus, // User receipt status
          error: receipt?.error || null,
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

        // --- NEW: Detect New Contracts (Tokens) ---
        // ONLY if it was a successful DEPLOY (or legacy fallback)
        if (tx.type === "DEPLOY") {
          // Debug Log
          console.log(
            `[Indexer] Check DEPLOY tx ${tx.hash} status=${txStatus}`,
          );

          if (txStatus === "success") {
            const contractAddress =
              receipt?.contractAddress ||
              this._deriveContractAddress(tx.from, tx.nonce);

            if (!contractAddress) {
              console.warn(
                `[Indexer] ⚠️ SKIP: Could not derive address for DEPLOY ${tx.hash}`,
              );
              continue;
            }

            let code = tx.data;
            let name = "Unknown Contract";
            let symbol = "???";

            // Try to parse modern DEPLOY format (JSON wrapper)
            try {
              const dataStr = tx.data.trim();
              if (dataStr.startsWith("{")) {
                const parsed = JSON.parse(dataStr);

                // Extract Code
                if (parsed.code) code = parsed.code;

                // Extract Metadata from Args (convention: [name, symbol, ...])
                if (Array.isArray(parsed.args) && parsed.args.length >= 2) {
                  name = parsed.args[0] || "Unknown Contract";
                  symbol = parsed.args[1] || "???";
                }

                console.log(
                  `[Indexer] Parsed DEPLOY data: Name=${name}, Symbol=${symbol}, CodeLen=${code.length}`,
                );
              }
            } catch (e) {
              console.warn(
                `[Indexer] Failed to parse DEPLOY JSON for ${tx.hash}: ${e.message}`,
              );
              // Fallback: use raw data as code
            }

            // Default to Custom Contract if standard detection fails
            const standard = this._detectStandard(code) || "Custom Contract";

            const tokenData = {
              address: contractAddress,
              deployer: tx.from,
              name,
              symbol,
              standard,
              timestamp: block.timestamp,
              blockIndex: block.index,
              txHash: tx.hash,
            };

            batch.push({
              type: "put",
              key: `token:${contractAddress}`,
              value: tokenData,
            });

            console.log(
              `[Indexer] ✅ CONTRACT INDEXED: ${name} (${symbol}) at ${contractAddress} [${standard}]`,
            );
          } else {
            console.warn(
              `[Indexer] ❌ DEPLOY Failed at #${block.index}: ${receipt?.error || "Unknown Error"}`,
            );
          }
        }
      }
    }

    // Index Events (if available)
    const blockEvents =
      (await this.callRpc("getEvents", { blockIndex: block.index })) || [];

    for (const event of blockEvents) {
      const key = `addr:event:${event.contract.toLowerCase()}:${block.timestamp}`;
      batch.push({ type: "put", key, value: event });

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

  _detectStandard(code) {
    if (!code) return "Unknown";
    // Heuristic: check for LMR-20 typical function signatures
    const hasTransfer = code.includes("function transfer(");
    const hasBalanceOf = code.includes("function balanceOf(");
    const hasApprove = code.includes("function approve(");

    if (hasTransfer && hasBalanceOf && hasApprove) return "LMR-20";
    return "Custom Contract";
  }

  _deriveContractAddress(from, nonce) {
    // Mimic StateManager._deriveContractAddress logic
    return "0x" + sha256(serialize({ from, nonce })).slice(-40);
  }

  async getTokens() {
    const tokens = [];
    const prefix = "token:";
    for await (const [key, value] of this.db.iterator({
      gte: prefix,
      lte: prefix + "\xFF",
    })) {
      tokens.push(value);
    }
    console.log(`[Indexer] getTokens: Found ${tokens.length} tokens in DB.`);
    return tokens.sort((a, b) => b.timestamp - a.timestamp);
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
