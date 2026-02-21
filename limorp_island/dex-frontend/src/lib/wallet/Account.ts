import * as bip39 from "bip39";
import { ec as EC } from "elliptic";
import { publicKeyToAddress, sha256, serialize } from "./crypto";
import { Buffer } from "buffer";

const ec = new EC("secp256k1");

export interface WalletData {
  mnemonic: string | null;
  privateKey: string;
  publicKey: string;
  address: string;
}

export class Account {
  public mnemonic: string | null;
  public privateKey: string;
  public publicKey: string;
  public address: string;

  constructor(data: WalletData) {
    this.mnemonic = data.mnemonic;
    this.privateKey = data.privateKey;
    this.publicKey = data.publicKey;
    this.address = data.address;
  }

  /**
   * Create a random 24-word account
   */
  static create(): Account {
    const mnemonic = bip39.generateMnemonic(256);
    return Account.fromMnemonic(mnemonic);
  }

  /**
   * Restore from mnemonic
   */
  static fromMnemonic(mnemonic: string): Account {
    const normalizedMnemonic = mnemonic
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!bip39.validateMnemonic(normalizedMnemonic)) {
      throw new Error(
        `Invalid mnemonic phrase. Please check the words and order.`,
      );
    }
    const seed = bip39.mnemonicToSeedSync(normalizedMnemonic);
    const privateKey = seed.slice(0, 32).toString("hex");
    const keyPair = ec.keyFromPrivate(privateKey, "hex");
    const publicKey = keyPair.getPublic("hex");
    const address = publicKeyToAddress(publicKey);

    return new Account({
      mnemonic: normalizedMnemonic,
      privateKey,
      publicKey,
      address,
    });
  }

  /**
   * Restore from private key
   */
  static fromPrivateKey(privateKeyHex: string): Account {
    const keyPair = ec.keyFromPrivate(privateKeyHex, "hex");
    const publicKey = keyPair.getPublic("hex");
    const address = publicKeyToAddress(publicKey);
    return new Account({
      mnemonic: null,
      privateKey: privateKeyHex,
      publicKey,
      address,
    });
  }

  /**
   * Sign arbitrary data
   */
  sign(data: any): string {
    const keyPair = ec.keyFromPrivate(this.privateKey, "hex");
    const hashData = serialize(data);
    const hash = sha256(hashData);
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
   * Sign a transaction hash
   */
  signHash(hash: string): string {
    const keyPair = ec.keyFromPrivate(this.privateKey, "hex");
    const sig = keyPair.sign(hash);

    return Buffer.from(
      JSON.stringify({
        r: sig.r.toString("hex"),
        s: sig.s.toString("hex"),
        pubKey: this.publicKey,
      }),
    ).toString("hex");
  }
}
