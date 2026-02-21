/**
 * DEXRouter.js - Limorp DEX Router Contract
 * Simplifies user interactions with Factory and Pairs.
 */

async function init(factory) {
  if (storage.initialized) throw new Error("Already initialized");
  storage.factory = factory;
  storage.initialized = true;
}

/**
 * Add Liquidity (Safe way)
 */
async function addLiquidity(
  tokenA,
  tokenB,
  amountADesired,
  amountBDesired,
  amountAMin,
  amountBMin,
  to,
  deadline,
) {
  if (block.timestamp > deadline) throw new Error("Expired");

  // 1. Get or Create Pair
  let pair = await call(storage.factory, "getPair", [tokenA, tokenB]);
  if (!pair) {
    pair = await call(storage.factory, "createPair", [tokenA, tokenB]);
  }

  // 2. Calculate optimal amounts (Simplified: for now we just use desired amounts)
  // In production, you'd check current reserves to maintain ratio

  // 3. Transfer tokens from user to Pair contract
  await call(tokenA, "transferFrom", [msg.sender, pair, amountADesired]);
  await call(tokenB, "transferFrom", [msg.sender, pair, amountBDesired]);

  // 4. Call mint on Pair
  const liquidity = await call(pair, "mint", [to]);

  return liquidity;
}

/**
 * Swap exact tokens for tokens (Simple single hop)
 */
async function swapExactTokensForTokens(
  amountIn,
  amountOutMin,
  path,
  to,
  deadline,
) {
  if (block.timestamp > deadline) throw new Error("Expired");
  if (path.length < 2) throw new Error("Invalid path");

  const tokenIn = path[0];
  const tokenOut = path[path.length - 1];

  console.log(`[ROUTER] Swapping from ${tokenIn} to ${tokenOut}`);
  const pair = await call(storage.factory, "getPair", [tokenIn, tokenOut]);
  if (!pair) throw new Error("No pool for pair");

  // Transfer from user to pair
  await call(tokenIn, "transferFrom", [msg.sender, pair, amountIn]);

  // Calculate out amount (Simplified logic for router)
  // In production, we'd iterate over the path for multi-hop
  const amounts = await getAmountsOut(amountIn, path);
  const amountOut = amounts[amounts.length - 1];

  if (amountOut < amountOutMin) throw new Error("Slippage too high");

  // Execute swap on pair
  // We need to know which token is token0/token1 in the pair to set amount0Out/amount1Out
  const token0 = await _getContractStorage(pair, "token0");
  const amount0Out = tokenOut === token0 ? amountOut : 0n;
  const amount1Out = tokenOut === token0 ? 0n : amountOut;

  await call(pair, "swap", [amount0Out, amount1Out, to]);

  return amounts;
}

/**
 * Helper to calculate output amount for a path
 */
async function getAmountsOut(amountIn, path) {
  const amounts = [BigInt(amountIn)];
  for (let i = 0; i < path.length - 1; i++) {
    const tokenIn = path[i];
    const tokenOut = path[i + 1];
    const pair = await call(storage.factory, "getPair", [tokenIn, tokenOut]);

    const res0 = await _getContractStorage(pair, "reserve0");
    const res1 = await _getContractStorage(pair, "reserve1");
    const t0 = await _getContractStorage(pair, "token0");

    const [reserveIn, reserveOut] =
      tokenIn === t0 ? [res0, res1] : [res1, res0];
    const amountOut = _getAmountOut(amounts[i], reserveIn, reserveOut);
    amounts.push(amountOut);
  }
  return amounts;
}

// --- Internal Math Helpers ---

function _getAmountOut(amountIn, reserveIn, reserveOut) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * 997n; // 0.3% fee
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

async function _getContractStorage(target, key) {
  // This is a placeholder for a cross-contract storage read if supported or use a getter
  // Since we don't have public storage vars in our VM yet, the Pair contract should expose them
  // For now, assume Pair has getters or we use internal call
  return await call(target, "getReserve", [key]); // We need to add getters to Pair
}
