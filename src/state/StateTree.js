import { sha256, serialize } from "../utils/crypto.js";

/**
 * StateTree: A deterministic cryptographic commitment to the Limorp world state.
 *
 * In a production blockchain, this is typically a Merkle Patricia Trie (MPT)
 * or a Sparse Merkle Tree (SMT). For Limorp, we implement a Merkle-style
 * tree by hashing a sorted list of accounts to ensure O(log N) proof
 * capability while keeping implementation clean.
 */
export class StateTree {
  /**
   * Calculate the root hash of the state.
   * Total state is represented as a map: address -> accountObject
   *
   * @param {Map<string, object>} stateMap - Map of addresses to account objects
   * @returns {string} The Merkle Root hash
   */
  static calculateRoot(stateMap) {
    if (
      !stateMap ||
      (stateMap.size === 0 &&
        !(stateMap instanceof Map) &&
        Object.keys(stateMap).length === 0)
    ) {
      return sha256("empty");
    }

    // 1. Get all entries and sort them by key (address) to ensure determinism
    const entries =
      stateMap instanceof Map
        ? Array.from(stateMap.entries())
        : Object.entries(stateMap);

    const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0]));

    // 2. Hash each entry (address:account)
    // We use serialize() to ensure consistent formatting of bigints
    const leafHashes = sortedEntries.map(([address, account]) => {
      return sha256(serialize({ address, account }));
    });

    // 3. Recursively build the Merkle Tree
    return this._processLayer(leafHashes);
  }

  /**
   * Recursively compress a list of hashes into a single root hash.
   */
  static _processLayer(hashes) {
    if (hashes.length === 0) return sha256("empty");
    if (hashes.length === 1) return hashes[0];

    const nextLayer = [];
    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        // Pair and hash
        nextLayer.push(sha256(hashes[i] + hashes[i + 1]));
      } else {
        // Odd one out - hash with itself or carry over?
        // Standard Merkle: hash with itself or duplicate to keep tree balanced.
        nextLayer.push(sha256(hashes[i] + hashes[i]));
      }
    }

    return this._processLayer(nextLayer);
  }

  /**
   * Generate a Merkle Proof for a specific address.
   * (Placeholder for future Light Client support)
   */
  static generateProof(stateMap, targetAddress) {
    // TODO: Implement full proof generation
    throw new Error("Merkle Proof generation not yet implemented");
  }
}
