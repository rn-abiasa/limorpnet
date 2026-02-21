import { Buffer } from "buffer";

/**
 * Basic Vault for Limorp Wallet
 * Handles encryption/decryption of the mnemonic using a password
 */
export class Vault {
  private static STORAGE_KEY = "limorp_vault";

  /**
   * Encrypt data using a password
   */
  static async encrypt(data: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const pwEncoded = encoder.encode(password);

    // Create a key from the password
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      pwEncoded,
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(data),
    );

    // Combine salt, iv, and encrypted data into a single base64 string
    const result = new Uint8Array(
      salt.length + iv.length + encrypted.byteLength,
    );
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    return Buffer.from(result).toString("base64");
  }

  /**
   * Decrypt data using a password
   */
  static async decrypt(
    encryptedBase64: string,
    password: string,
  ): Promise<string> {
    const combined = Buffer.from(encryptedBase64, "base64");

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);

    const encoder = new TextEncoder();
    const pwEncoded = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      pwEncoded,
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Save the vault to chrome storage
   */
  static async save(encryptedData: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: encryptedData }, () => {
        resolve();
      });
    });
  }

  /**
   * Load the vault from chrome storage
   */
  static async load(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [this.STORAGE_KEY],
        (result: { [key: string]: any }) => {
          resolve(result[this.STORAGE_KEY] || null);
        },
      );
    });
  }

  /**
   * Check if a vault exists
   */
  static async exists(): Promise<boolean> {
    const data = await this.load();
    return !!data;
  }
}
