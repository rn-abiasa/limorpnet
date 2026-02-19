import { createHash } from "crypto";

/**
 * Utility crypto helpers (Decoupled version for Scanner)
 */

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
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
