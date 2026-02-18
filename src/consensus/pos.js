import { createLogger } from "../utils/logger.js";
import { sha256 } from "../utils/crypto.js";

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
    const eligible = validators.filter((v) => v.stake >= this.minStake);
    if (eligible.length === 0) return null;

    const totalStake = eligible.reduce((sum, v) => sum + v.stake, 0n);
    if (totalStake === 0n) return null;

    // Use the full hash as a BigInt to ensure it's larger than any possible total stake
    const slotSeed = `${seed}-${slot}`;
    const hashHex = sha256(slotSeed);
    let target = BigInt("0x" + hashHex) % totalStake;

    for (const validator of eligible) {
      if (target < validator.stake) {
        return validator.address;
      }
      target -= validator.stake;
    }

    return eligible[eligible.length - 1].address;
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
