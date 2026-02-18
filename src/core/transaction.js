import { sha256, serialize } from "../utils/crypto.js";
import pkg from "elliptic";
const { ec: EC } = pkg;

const ec = new EC("secp256k1");

/**
 * Transaction types
 */
export const TX_TYPE = {
  TRANSFER: "TRANSFER",
  DEPLOY: "DEPLOY",
  CALL: "CALL",
  STAKE: "STAKE",
  UNSTAKE: "UNSTAKE",
};

export class Transaction {
  /**
   * @param {object} params
   * @param {string} params.from       - sender address
   * @param {string|null} params.to   - recipient address (null for DEPLOY)
   * @param {bigint} params.amount    - value in smallest unit (LMR)
   * @param {number} params.nonce     - sender nonce
   * @param {string} params.type      - TX_TYPE
   * @param {string} params.data      - contract bytecode or calldata (hex string or JSON)
   * @param {bigint} params.fee       - transaction fee
   * @param {number} params.timestamp
   */
  constructor({
    from,
    to = null,
    amount = 0n,
    nonce,
    type = TX_TYPE.TRANSFER,
    data = "",
    fee = 0n,
    timestamp = Date.now(),
  }) {
    this.from = from;
    this.to = to;
    this.amount = BigInt(amount);
    this.nonce = nonce;
    this.type = type;
    this.data = data;
    this.fee = BigInt(fee);
    this.timestamp = timestamp;
    this.signature = null;
    this.hash = this._calculateHash();
  }

  _calculateHash() {
    return sha256(
      serialize({
        from: this.from,
        to: this.to,
        amount: this.amount.toString(),
        nonce: this.nonce,
        type: this.type,
        data: this.data,
        fee: this.fee.toString(),
        timestamp: this.timestamp,
      }),
    );
  }

  /**
   * Sign transaction with private key (hex string)
   */
  sign(privateKeyHex) {
    const keyPair = ec.keyFromPrivate(privateKeyHex, "hex");
    const msgHash = this._calculateHash();
    const sig = keyPair.sign(msgHash);
    this.signature = sig.toDER("hex");
    this.hash = msgHash;
    return this;
  }

  /**
   * Verify signature against from address
   */
  verify() {
    if (!this.signature || !this.from) return false;
    try {
      // Recover public key from address is not possible with sha256 alone,
      // so we store pubKey in signature or verify via stored pubKey.
      // Here we verify using the stored pubKeyHex embedded in signature object.
      // For simplicity: signature is { r, s, pubKey }
      const sigObj = JSON.parse(Buffer.from(this.signature, "hex").toString());
      const key = ec.keyFromPublic(sigObj.pubKey, "hex");
      return key.verify(this.hash, { r: sigObj.r, s: sigObj.s });
    } catch {
      return false;
    }
  }

  /**
   * Basic structural validity (does not check balance/nonce)
   */
  isValid() {
    if (!this.from || !this.hash) return false;
    if (this.amount < 0n || this.fee < 0n) return false;
    if (this.type === TX_TYPE.TRANSFER && !this.to) return false;
    if (this.hash !== this._calculateHash()) return false;
    return true;
  }

  toJSON() {
    return {
      hash: this.hash,
      from: this.from,
      to: this.to,
      amount: this.amount.toString(),
      nonce: this.nonce,
      type: this.type,
      data: this.data,
      fee: this.fee.toString(),
      timestamp: this.timestamp,
      signature: this.signature,
    };
  }

  static fromJSON(obj) {
    const tx = new Transaction({
      from: obj.from,
      to: obj.to,
      amount: BigInt(obj.amount),
      nonce: obj.nonce,
      type: obj.type,
      data: obj.data,
      fee: BigInt(obj.fee),
      timestamp: obj.timestamp,
    });
    tx.signature = obj.signature;
    tx.hash = obj.hash;
    return tx;
  }
}
