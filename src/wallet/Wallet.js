import bip39pkg from "bip39";
const { generateMnemonic, validateMnemonic, mnemonicToSeedSync } = bip39pkg;
import ellipticpkg from "elliptic";
const { ec: EC } = ellipticpkg;
import { publicKeyToAddress, sha256 } from "../utils/crypto.js";

const ec = new EC("secp256k1");

export class Wallet {
  constructor({ mnemonic, privateKey, publicKey, address }) {
    this.mnemonic = mnemonic;
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.address = address;
  }

  /**
   * Create a new wallet from a random BIP39 mnemonic
   */
  static create() {
    const mnemonic = generateMnemonic(256); // 24 words
    return Wallet.fromMnemonic(mnemonic);
  }

  /**
   * Restore wallet from BIP39 mnemonic
   */
  static fromMnemonic(mnemonic) {
    if (!validateMnemonic(mnemonic)) {
      throw new Error("Invalid mnemonic");
    }
    const seed = mnemonicToSeedSync(mnemonic);
    const privateKey = seed.slice(0, 32).toString("hex");
    const keyPair = ec.keyFromPrivate(privateKey, "hex");
    const publicKey = keyPair.getPublic("hex");
    const address = publicKeyToAddress(publicKey);

    return new Wallet({ mnemonic, privateKey, publicKey, address });
  }

  /**
   * Restore wallet from private key hex
   */
  static fromPrivateKey(privateKeyHex) {
    const keyPair = ec.keyFromPrivate(privateKeyHex, "hex");
    const publicKey = keyPair.getPublic("hex");
    const address = publicKeyToAddress(publicKey);
    return new Wallet({
      mnemonic: null,
      privateKey: privateKeyHex,
      publicKey,
      address,
    });
  }

  /**
   * Sign arbitrary data (returns DER hex with embedded pubKey for verification)
   */
  sign(data) {
    const keyPair = ec.keyFromPrivate(this.privateKey, "hex");
    const hash = sha256(typeof data === "string" ? data : JSON.stringify(data));
    const sig = keyPair.sign(hash);
    return Buffer.from(
      JSON.stringify({
        r: sig.r.toString("hex"),
        s: sig.s.toString("hex"),
        pubKey: this.publicKey,
      }),
    ).toString("hex");
  }

  /**
   * Sign a Transaction object (mutates tx.signature and tx.hash)
   */
  signTransaction(tx) {
    const keyPair = ec.keyFromPrivate(this.privateKey, "hex");
    const sig = keyPair.sign(tx.hash);
    tx.signature = Buffer.from(
      JSON.stringify({
        r: sig.r.toString("hex"),
        s: sig.s.toString("hex"),
        pubKey: this.publicKey,
      }),
    ).toString("hex");
    return tx;
  }

  /**
   * Sign a Block object (mutates block.signature)
   */
  signBlock(block) {
    const keyPair = ec.keyFromPrivate(this.privateKey, "hex");
    const sig = keyPair.sign(block.hash);
    block.signature = Buffer.from(
      JSON.stringify({
        r: sig.r.toString("hex"),
        s: sig.s.toString("hex"),
        pubKey: this.publicKey,
      }),
    ).toString("hex");
    return block;
  }

  toJSON() {
    return {
      address: this.address,
      publicKey: this.publicKey,
      mnemonic: this.mnemonic,
    };
  }
}
