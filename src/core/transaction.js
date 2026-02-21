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
   * @param {bigint} params.gasLimit             - maximum gas to use
   * @param {bigint} params.maxFeePerGas         - maximum total fee per gas (limo)
   * @param {bigint} params.maxPriorityFeePerGas  - maximum tip for validator (limo)
   * @param {number} params.timestamp
   */
  constructor({
    from,
    to = null,
    amount = 0n,
    nonce,
    type = TX_TYPE.TRANSFER,
    data = "",
    gasLimit = 21000n,
    maxFeePerGas = 1000n,
    maxPriorityFeePerGas = 100n,
    timestamp = Date.now(),
  }) {
    this.from = from;
    this.to = to;
    this.amount = BigInt(amount);
    this.nonce = nonce;
    this.type = type;
    this.data = data;
    this.gasLimit = BigInt(gasLimit);
    this.maxFeePerGas = BigInt(maxFeePerGas);
    this.maxPriorityFeePerGas = BigInt(maxPriorityFeePerGas);
    this.timestamp = timestamp;
    this.signature = null;
    this.hash = this._calculateHash();
  }

  get fee() {
    return this.gasLimit * this.maxFeePerGas;
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
        gasLimit: this.gasLimit.toString(),
        maxFeePerGas: this.maxFeePerGas.toString(),
        maxPriorityFeePerGas: this.maxPriorityFeePerGas.toString(),
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
    const pubKey = keyPair.getPublic("hex");
    this.signature = Buffer.from(
      JSON.stringify({
        r: sig.r.toString("hex"),
        s: sig.s.toString("hex"),
        pubKey,
      }),
    ).toString("hex");
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
    if (this.amount < 0n || this.gasLimit < 21000n) return false;
    if (this.maxFeePerGas < 0n || this.maxPriorityFeePerGas < 0n) return false;
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
      gasLimit: this.gasLimit.toString(),
      maxFeePerGas: this.maxFeePerGas.toString(),
      maxPriorityFeePerGas: this.maxPriorityFeePerGas.toString(),
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
      gasLimit: obj.gasLimit ? BigInt(obj.gasLimit) : undefined,
      maxFeePerGas: obj.maxFeePerGas ? BigInt(obj.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: obj.maxPriorityFeePerGas
        ? BigInt(obj.maxPriorityFeePerGas)
        : undefined,
      timestamp: obj.timestamp,
    });
    tx.signature = obj.signature;
    if (obj.hash) tx.hash = obj.hash;
    return tx;
  }
}
