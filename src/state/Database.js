import { Level } from "level";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Database");

export class Database {
  /**
   * @param {string} dataDir - path to LevelDB directory
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.db = null;
  }

  async open() {
    this.db = new Level(this.dataDir, { valueEncoding: "utf8" });
    await this.db.open();
    logger.info("Database opened", { path: this.dataDir });
  }

  async close() {
    if (this.db) {
      await this.db.close();
      logger.info("Database closed");
    }
  }

  async get(key) {
    return this.db.get(key);
  }

  async put(key, value) {
    return this.db.put(key, value);
  }

  async del(key) {
    return this.db.del(key);
  }

  /**
   * Atomic batch write
   * @param {Array<{type: 'put'|'del', key: string, value?: string}>} ops
   */
  async batch(ops) {
    return this.db.batch(ops);
  }

  /**
   * Iterate over keys with a prefix
   * @param {string} prefix
   * @returns {AsyncIterable<{key: string, value: string}>}
   */
  async *iterate(prefix) {
    for await (const [key, value] of this.db.iterator({
      gte: prefix,
      lte: prefix + "\xFF",
    })) {
      yield { key, value };
    }
  }
}
