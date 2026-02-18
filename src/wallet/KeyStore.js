import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { Wallet } from "./Wallet.js";

const ALGORITHM = "aes-256-gcm";

export class KeyStore {
  /**
   * Save wallet to encrypted JSON file
   * @param {Wallet} wallet
   * @param {string} filePath
   * @param {string} password
   */
  static save(wallet, filePath, password) {
    const salt = randomBytes(32);
    const iv = randomBytes(12);
    const key = scryptSync(password, salt, 32);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const plaintext = JSON.stringify({
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic,
      address: wallet.address,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const keystore = {
      version: 1,
      address: wallet.address,
      crypto: {
        cipher: ALGORITHM,
        ciphertext: encrypted.toString("hex"),
        iv: iv.toString("hex"),
        salt: salt.toString("hex"),
        authTag: authTag.toString("hex"),
        kdf: "scrypt",
      },
    };

    writeFileSync(filePath, JSON.stringify(keystore, null, 2));
    return keystore;
  }

  /**
   * Load and decrypt wallet from keystore file
   * @param {string} filePath
   * @param {string} password
   * @returns {Wallet}
   */
  static load(filePath, password) {
    if (!existsSync(filePath)) {
      throw new Error(`Keystore file not found: ${filePath}`);
    }

    const keystore = JSON.parse(readFileSync(filePath, "utf8"));
    const { ciphertext, iv, salt, authTag } = keystore.crypto;

    const key = scryptSync(password, Buffer.from(salt, "hex"), 32);
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "hex")),
      decipher.final(),
    ]).toString("utf8");

    const { privateKey } = JSON.parse(decrypted);
    return Wallet.fromPrivateKey(privateKey);
  }
}
