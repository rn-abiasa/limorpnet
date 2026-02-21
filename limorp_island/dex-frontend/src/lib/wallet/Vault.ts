import { Buffer } from "buffer";

/**
 * Vault handles encrypted storage of sensitive wallet data using AES-GCM
 */
export class Vault {
  private static STORAGE_KEY = "limorp_vault";

  /**
   * Encrypt and store data
   */
  static async encrypt(password: string, data: any): Promise<void> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Derive key using PBKDF2 (simplified for this context, but better than raw hash)
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey(
      "raw",
      passwordBuffer,
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
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(data)),
    );

    const result = {
      salt: Buffer.from(salt).toString("hex"),
      iv: Buffer.from(iv).toString("hex"),
      ciphertext: Buffer.from(encryptedData).toString("hex"),
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(result));
  }

  /**
   * Decrypt and retrieve data
   */
  static async decrypt(password: string): Promise<any | null> {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;

    try {
      const { salt, iv, ciphertext } = JSON.parse(raw);
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(password);

      const baseKey = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        "PBKDF2",
        false,
        ["deriveKey"],
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: Buffer.from(salt, "hex"),
          iterations: 100000,
          hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: Buffer.from(iv, "hex") },
        key,
        Buffer.from(ciphertext, "hex"),
      );

      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      console.error("Decryption failed:", e);
      return null;
    }
  }

  /**
   * Check if vault exists
   */
  static exists(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }

  /**
   * Delete vault
   */
  static delete(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
