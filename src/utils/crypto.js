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
 * Serialize data deterministically for hashing/signing (recursively sorts keys)
 */
export function serialize(obj) {
  const replacer = (_, v) => (typeof v === "bigint" ? v.toString() : v);

  const sortObject = (input) => {
    if (input === null || typeof input !== "object") return input;
    if (Array.isArray(input)) return input.map(sortObject);

    return Object.keys(input)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(input[key]);
        return acc;
      }, {});
  };

  return JSON.stringify(sortObject(obj), replacer);
}
