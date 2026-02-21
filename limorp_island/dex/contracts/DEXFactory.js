/**
 * DEXFactory.js - Limorp DEX Factory Contract
 * Creates and manages DEXPair contracts.
 */

async function init(pairCode) {
  if (storage.initialized) throw new Error("Already initialized");

  storage.pairCode = pairCode; // Store the source code of DEXPair for future deployments
  storage.getPair = {}; // tokenA + tokenB -> pairAddress
  storage.allPairs = []; // List of all created pairs

  storage.owner = msg.sender;
  storage.initialized = true;

  emit("FactoryInitialized", { owner: msg.sender });
}

/**
 * Create a new trading pair for two tokens
 */
async function createPair(tokenA, tokenB) {
  if (tokenA === tokenB) throw new Error("Identical addresses");

  // Sort addresses for consistent mapping
  const [t0, t1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];

  if (!t0 || !t1) throw new Error("Invalid token address");
  if (storage.getPair[t0 + t1]) throw new Error("Pair already exists");

  // Deploy new DEXPair contract using the internal 'deploy' helper
  // Args for DEXPair init: [token0, token1, factoryAddress]
  const pairAddress = await deploy(storage.pairCode, [t0, t1, self]);

  console.log(`[FACTORY] Pair created: ${t0} + ${t1} -> ${pairAddress}`);
  storage.getPair[t0 + t1] = pairAddress;
  storage.getPair[t1 + t0] = pairAddress; // Map both ways
  storage.allPairs.push(pairAddress);

  emit("PairCreated", {
    token0: t0,
    token1: t1,
    pair: pairAddress,
    count: storage.allPairs.length,
  });

  return pairAddress;
}

/**
 * Update the pair code (useful for upgrades)
 */
async function setPairCode(newCode) {
  if (msg.sender !== storage.owner) throw new Error("Only owner");
  storage.pairCode = newCode;
}

function allPairsLength() {
  return storage.allPairs.length;
}

function getPair(tokenA, tokenB) {
  const [t0, t1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
  return storage.getPair[t0 + t1] || null;
}
