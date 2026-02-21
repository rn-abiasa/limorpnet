import { sha256 as jsSha256 } from "js-sha256";

/**
 * Utility crypto helpers for Limorp Wallet
 */

export function sha256(data: string | Uint8Array): string {
  return jsSha256(data);
}

export function sha256Double(data: string | Uint8Array): string {
  return sha256(sha256(data));
}

/**
 * Derive address from public key (last 20 bytes of sha256, prefixed with 0x)
 */
export function publicKeyToAddress(publicKeyHex: string): string {
  const hash = sha256(publicKeyHex);
  return "0x" + hash.slice(-40);
}

/**
 * Serialize data deterministically for hashing/signing
 */
export function serialize(obj: any): string {
  const replacer = (_: string, v: any) =>
    typeof v === "bigint" ? v.toString() : v;

  const sortObject = (input: any): any => {
    if (input === null || typeof input !== "object") return input;
    if (Array.isArray(input)) return input.map(sortObject);

    return Object.keys(input)
      .sort()
      .reduce((acc: any, key: string) => {
        acc[key] = sortObject(input[key]);
        return acc;
      }, {});
  };

  return JSON.stringify(sortObject(obj), replacer);
}
