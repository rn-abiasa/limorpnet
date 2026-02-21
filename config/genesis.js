/**
 * Genesis configuration for Limorp blockchain
 *
 * TOKENOMICS:
 * - No fixed cap (inflationary, controlled by block reward decay)
 * - Block reward decreases every REWARD_DECAY_BLOCKS blocks
 * - Transaction fee: 50% burned, 50% to validator
 * - Genesis pre-allocation for bootstrap (validators, foundation, treasury)
 */

// 1 LMR = 1_000_000_000_000_000_000 (18 decimals)
const LMR = 1_000_000_000_000_000_000n;

export const genesis = {
  chainId: "limorp-1",
  timestamp: 0,
  stateRoot: "",

  // ── Chain Parameters ──────────────────────────────────────────────────────
  params: {
    blockTime: 5000, // 5 seconds per block
    minStake: (1000n * LMR).toString(), // 10 LMR minimum to be validator

    // Block reward schedule (decay every N blocks)
    initialBlockReward: (500n * LMR).toString(), // 10 LMR/block at start
    rewardDecayBlocks: 1_051_200, // ~1 year (5s block = 6,307,200 blocks/year, halved)
    rewardDecayFactor: 0.8, // multiply by 0.8 every decay period (20% reduction)
    minBlockReward: ((1n * LMR) / 10n).toString(), // 0.1 LMR minimum reward (never 0)

    // Fee distribution (EIP-1559 style)
    feeBurnPercent: 100, // 100% of BASE FEE is burned (Standard)
    initialBaseFee: 1_000n.toString(), // 1000 limo minimum
    targetGasPerBlock: 15_000_000,
    maxGasPerBlock: 30_000_000,

    maxTxPerBlock: 1000, // Increased as we now use gas limits
  },

  // ── Genesis Pre-allocation ────────────────────────────────────────────────
  // Fill in your addresses below. All amounts in LMR (18 decimals).
  // These accounts will be funded at block 0 to bootstrap the network.
  initialState: {
    // ── Validator Nodes ──────────────────────────────────────────────────
    // Each validator needs enough to stake (min 10 LMR) + pay fees
    // Replace with your actual validator addresses
    "0xcf59cb9378ccfd9f1be5e9f602d1a18cd8491b24": {
      balance: (1_000_000n * LMR).toString(), // 1,000,000 LMR
      stake: (1000n * LMR).toString(), // 10 LMR pre-staked
    },
    // 'YOUR_VALIDATOR_2_ADDRESS': {
    //   balance: (1_000_000n * LMR).toString(),
    //   stake:   (10n * LMR).toString(),
    // },
    // ── Foundation / Treasury ────────────────────────────────────────────
    // For ecosystem grants, development, marketing
    "0x5391a081143d2ae3ad6c39e204f49888366cc2da": {
      balance: (5_000_000n * LMR).toString(), // 5,000,000 LMR
      stake: "0",
    },
    // 'YOUR_TREASURY_ADDRESS': {
    //   balance: (3_000_000n * LMR).toString(),  // 3,000,000 LMR
    //   stake:   '0',
    // },
  },
};
