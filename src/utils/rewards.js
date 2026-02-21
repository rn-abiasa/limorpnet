import { genesis } from "../../config/genesis.js";

const { params } = genesis;

/**
 * Calculate block reward at a given block height.
 * Reward decays by rewardDecayFactor every rewardDecayBlocks blocks.
 *
 * Example with defaults:
 *   Block 0–1,051,199:      10 LMR
 *   Block 1,051,200–2,102,399: 8 LMR
 *   Block 2,102,400–3,153,599: 6.4 LMR
 *   ...
 *   Minimum: 0.1 LMR (never goes below)
 *
 * @param {number} blockHeight
 * @returns {bigint} reward in smallest unit (wei)
 */
export function calculateBlockReward(blockHeight) {
  const initial = BigInt(params.initialBlockReward);
  const minReward = BigInt(params.minBlockReward);
  const decayEvery = params.rewardDecayBlocks;
  const factor = params.rewardDecayFactor; // e.g. 0.8

  const periods = Math.floor(blockHeight / decayEvery);
  if (periods === 0) return initial > minReward ? initial : minReward;

  // reward = initial * factor^periods
  // Use floating point then convert back to BigInt
  const multiplier = Math.pow(factor, periods);
  const reward = BigInt(Math.floor(Number(initial) * multiplier));

  return reward > minReward ? reward : minReward;
}
