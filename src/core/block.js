import { sha256, serialize } from "../utils/crypto.js";
import pkg from "elliptic";
const { ec: EC } = pkg;

const ec = new EC("secp256k1");

export class Block {
  /**
   * @param {object} params
   * @param {number} params.index
   * @param {string} params.previousHash
   * @param {Transaction[]} params.transactions
   * @param {string} params.validator        - validator address
   * @param {number} params.timestamp
   * @param {string} params.stateRoot        - hash of state after applying block
   */
  constructor({
    index,
    previousHash,
    transactions = [],
    validator,
    timestamp = Date.now(),
    stateRoot = "",
  }) {
    this.index = index;
    this.previousHash = previousHash;
    this.transactions = transactions;
    this.validator = validator;
    this.timestamp = timestamp;
    this.stateRoot = stateRoot;
    this.signature = null;
    this.hash = this._calculateHash();
  }

  _calculateHash() {
    return sha256(
      serialize({
        index: this.index,
        previousHash: this.previousHash,
        transactions: this.transactions.map((tx) => tx.hash ?? tx),
        validator: this.validator,
        timestamp: this.timestamp,
        stateRoot: this.stateRoot,
      }),
    );
  }

  /**
   * Validator signs the block with their private key
   */
  sign(privateKeyHex) {
    const keyPair = ec.keyFromPrivate(privateKeyHex, "hex");
    const sig = keyPair.sign(this.hash);
    const pubKey = keyPair.getPublic("hex");
    this.signature = Buffer.from(
      JSON.stringify({
        r: sig.r.toString("hex"),
        s: sig.s.toString("hex"),
        pubKey,
      }),
    ).toString("hex");
    return this;
  }

  /**
   * Verify block signature
   */
  verifySignature() {
    if (!this.signature) return false;
    try {
      const sigObj = JSON.parse(Buffer.from(this.signature, "hex").toString());
      const key = ec.keyFromPublic(sigObj.pubKey, "hex");
      return key.verify(this.hash, { r: sigObj.r, s: sigObj.s });
    } catch {
      return false;
    }
  }

  isValid(previousBlock) {
    if (this.hash !== this._calculateHash()) return false;
    if (previousBlock && this.previousHash !== previousBlock.hash) return false;
    if (previousBlock && this.index !== previousBlock.index + 1) return false;
    return true;
  }

  toJSON() {
    return {
      index: this.index,
      hash: this.hash,
      previousHash: this.previousHash,
      transactions: this.transactions.map((tx) =>
        tx.toJSON ? tx.toJSON() : tx,
      ),
      validator: this.validator,
      timestamp: this.timestamp,
      stateRoot: this.stateRoot,
      signature: this.signature,
    };
  }

  static fromJSON(obj) {
    const block = new Block({
      index: obj.index,
      previousHash: obj.previousHash,
      transactions: obj.transactions ?? [],
      validator: obj.validator,
      timestamp: obj.timestamp,
      stateRoot: obj.stateRoot ?? "",
    });
    block.hash = obj.hash;
    block.signature = obj.signature;
    return block;
  }
}

/**
 * Create the genesis block
 */
export function createGenesisBlock(genesisConfig) {
  const block = new Block({
    index: 0,
    previousHash: "0".repeat(64),
    transactions: [],
    validator: "genesis",
    timestamp: genesisConfig.timestamp || 0,
    stateRoot: genesisConfig.stateRoot || "",
  });
  return block;
}
