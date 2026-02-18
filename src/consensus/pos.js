import { createLogger } from "../utils/logger.js";

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
   * @returns {string|null} selected validator address
   */
  selectValidator(validators, seed) {
    const eligible = validators.filter((v) => v.stake >= this.minStake);
    if (eligible.length === 0) return null;

    const totalStake = eligible.reduce((sum, v) => sum + v.stake, 0n);
    if (totalStake === 0n) return null;

    // Deterministic random from seed
    const seedNum = BigInt("0x" + seed.slice(0, 16));
    let target = seedNum % totalStake;

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
    const expected = this.selectValidator(validators, previousBlock.hash);
    return expected === address;
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
