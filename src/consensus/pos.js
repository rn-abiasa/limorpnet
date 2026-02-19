import { createLogger } from "../utils/logger.js";
import { sha256, serialize } from "../utils/crypto.js";

const logger = createLogger("PoS");

export class PoS {
  /**
   * @param {object} config
   * @param {bigint} config.minStake    - minimum stake to be a validator (in smallest unit)
   * @param {number} config.blockTime   - target block time in milliseconds
   */
  constructor({ minStake = 1000000000000000000n, blockTime = 5000 } = {}) {
    this.minStake = BigInt(minStake);
    this.blockTime = blockTime;
  }

  /**
   * Select validator using weighted random (stake-proportional)
   * @param {Array<{address: string, stake: bigint}>} validators
   * @param {string} seed - deterministic seed (e.g. previous block hash)
   * @param {number} slot - the time slot index since previous block
   * @returns {string|null} selected validator address
   */
  selectValidator(validators, seed, slot = 0) {
    const eligible = validators
      .filter((v) => v.stake >= this.minStake)
      .sort((a, b) => a.address.localeCompare(b.address)); // Deterministic order

    if (eligible.length === 0) return null;

    const totalStake = eligible.reduce((sum, v) => sum + v.stake, 0n);
    if (totalStake === 0n) return null;

    // Use a fixed seed for the primary winner of this block height
    // This makes the rotation predictable across nodes
    if (typeof sha256 !== "function") {
      throw new Error("sha256 is not defined in selectValidator scope!");
    }
    const baseTarget = BigInt("0x" + sha256(seed)) % totalStake;

    // Find the primary weighted-random winner index
    let current = 0n;
    let primaryWinnerIdx = 0;
    for (let i = 0; i < eligible.length; i++) {
      current += eligible[i].stake;
      if (baseTarget < current) {
        primaryWinnerIdx = i;
        break;
      }
    }

    // Forced Round Robin Fallback:
    // If slot=0, we use the primary winner.
    // If slot > 0, we shift the winner index by the slot number.
    // This guarantees that within 'eligible.length' slots, EVERY validator gets a turn.
    const finalWinnerIdx = (primaryWinnerIdx + slot) % eligible.length;

    return eligible[finalWinnerIdx].address;
  }

  /**
   * Check if a given address is the expected validator for a block
   * @param {string} address
   * @param {import('../core/block.js').Block} block
   * @param {import('../core/block.js').Block} previousBlock
   * @param {Array<{address: string, stake: bigint}>} validators
   * @returns {boolean}
   */
  isValidValidator(address, block, previousBlock, validators) {
    // Calculate which slot this block's timestamp falls into
    const elapsed = block.timestamp - previousBlock.timestamp;
    const slot = Math.floor(elapsed / this.blockTime);

    if (slot < 1) {
      logger.warn("Block timestamp too close to previous block", { slot });
      return false;
    }

    const expected = this.selectValidator(validators, previousBlock.hash, slot);
    const result = expected && expected.toLowerCase() === address.toLowerCase();

    if (!result) {
      logger.warn("Invalid validator for slot", {
        slot,
        expected,
        received: address,
      });
    }

    return result;
  }

  /**
   * Check if it's time to produce a new block
   * @param {import('../core/block.js').Block} latestBlock
   * @returns {boolean}
   */
  isTimeToProduceBlock(latestBlock) {
    return Date.now() - latestBlock.timestamp >= this.blockTime;
  }
}
