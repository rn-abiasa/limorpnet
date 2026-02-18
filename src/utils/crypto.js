import { createHash } from "crypto";

/**
 * Utility crypto helpers
 */

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256Double(data) {
  return sha256(sha256(data));
}

/**
 * Derive address from public key (last 20 bytes of sha256, prefixed with 0x)
 */
export function publicKeyToAddress(publicKeyHex) {
  const hash = sha256(publicKeyHex);
  return "0x" + hash.slice(-40);
}

/**
 * Serialize data deterministically for hashing/signing
 */
export function serialize(obj) {
  return JSON.stringify(obj, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}
