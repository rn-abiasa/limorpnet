/**
 * DEXPair.js - Limorp DEX Core Pair Contract
 * Based on Uniswap V2 AMM model (x * y = k)
 */

// --- Constants ---
const MINIMUM_LIQUIDITY = 1000n;

async function init(token0, token1, factory) {
  if (storage.initialized) throw new Error("Already initialized");

  storage.token0 = token0;
  storage.token1 = token1;
  storage.factory = factory;

  storage.reserve0 = 0n;
  storage.reserve1 = 0n;
  storage.blockTimestampLast = 0;

  // LP Token Metadata (LMR-20)
  storage.name = "Limorp LP Token";
  storage.symbol = "LLP";
  storage.decimals = 18;
  storage.totalSupply = 0n;
  storage.balances = {};
  storage.allowances = {};

  storage.initialized = true;
}

// --- AMM Logic ---

/**
 * Mint LP Tokens to 'to' based on current reserves
 */
async function mint(to) {
  const res0 = await _getContractBalance(storage.token0);
  const res1 = await _getContractBalance(storage.token1);

  const amount0 = res0 - storage.reserve0;
  const amount1 = res1 - storage.reserve1;

  let liquidity;
  const totalSupply = storage.totalSupply;

  if (totalSupply === 0n) {
    // Initial liquidity
    liquidity = _sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
    _mint("0x0000000000000000000000000000000000000000", MINIMUM_LIQUIDITY); // Permanently lock
  } else {
    // liquidity = min( (amount0 * totalSupply) / reserve0, (amount1 * totalSupply) / reserve1 )
    const l0 = (amount0 * totalSupply) / storage.reserve0;
    const l1 = (amount1 * totalSupply) / storage.reserve1;
    liquidity = l0 < l1 ? l0 : l1;
  }

  if (liquidity <= 0n) throw new Error("Insufficient liquidity minted");

  _mint(to, liquidity);
  _update(res0, res1);

  emit("Mint", { sender: msg.sender, amount0, amount1 });
  return liquidity;
}

/**
 * Burn LP Tokens to return actual assets
 */
async function burn(to) {
  const balance = storage.balances[msg.sender] || 0n;
  if (balance <= 0n) throw new Error("No liquidity to burn");

  const res0 = await _getContractBalance(storage.token0);
  const res1 = await _getContractBalance(storage.token1);

  const totalSupply = storage.totalSupply;
  const amount0 = (balance * res0) / totalSupply;
  const amount1 = (balance * res1) / totalSupply;

  if (amount0 <= 0n || amount1 <= 0n)
    throw new Error("Insufficient liquidity burned");

  _burn(msg.sender, balance);

  // Send assets back to user
  await call(storage.token0, "transfer", [to, amount0]);
  await call(storage.token1, "transfer", [to, amount1]);

  const newRes0 = await _getContractBalance(storage.token0);
  const newRes1 = await _getContractBalance(storage.token1);

  _update(newRes0, newRes1);

  emit("Burn", { sender: msg.sender, amount0, amount1, to });
  return { amount0, amount1 };
}

/**
 * Swap tokens
 */
async function swap(amount0Out, amount1Out, to) {
  if (amount0Out <= 0n && amount1Out <= 0n)
    throw new Error("Insufficient output amount");

  const res0 = storage.reserve0;
  const res1 = storage.reserve1;

  if (amount0Out >= res0 || amount1Out >= res1)
    throw new Error("Insufficient liquidity in pool");

  if (to === storage.token0 || to === storage.token1)
    throw new Error("Invalid to address");

  // Transfer out
  if (amount0Out > 0n) await call(storage.token0, "transfer", [to, amount0Out]);
  if (amount1Out > 0n) await call(storage.token1, "transfer", [to, amount1Out]);

  const balance0 = await _getContractBalance(storage.token0);
  const balance1 = await _getContractBalance(storage.token1);

  const amount0In =
    balance0 > res0 - amount0Out ? balance0 - (res0 - amount0Out) : 0n;
  const amount1In =
    balance1 > res1 - amount1Out ? balance1 - (res1 - amount1Out) : 0n;

  if (amount0In <= 0n && amount1In <= 0n)
    throw new Error("Insufficient input amount");

  // Ensure constant product formula x * y = k with 0.3% fee
  // (balance0 - amount0In * 0.003) * (balance1 - amount1In * 0.003) >= res0 * res1
  const balance0Adjusted = balance0 * 1000n - amount0In * 3n;
  const balance1Adjusted = balance1 * 1000n - amount1In * 3n;

  if (balance0Adjusted * balance1Adjusted < res0 * res1 * 1000000n) {
    throw new Error("K invariant failed");
  }

  _update(balance0, balance1);
  emit("Swap", {
    sender: msg.sender,
    amount0In,
    amount1In,
    amount0Out,
    amount1Out,
    to,
  });
}

async function sync() {
  const b0 = await _getContractBalance(storage.token0);
  const b1 = await _getContractBalance(storage.token1);
  _update(b0, b1);
}

function getReserve(key) {
  if (key === "reserve0") return storage.reserve0;
  if (key === "reserve1") return storage.reserve1;
  return 0n;
}

function getToken(key) {
  if (key === "token0") return storage.token0;
  if (key === "token1") return storage.token1;
  return null;
}

// --- Internal Helpers ---

function _update(res0, res1) {
  storage.reserve0 = res0;
  storage.reserve1 = res1;
  storage.blockTimestampLast = block.timestamp;
}

async function _getContractBalance(token) {
  // In Limorp vm, we use call(token, "balanceOf", [self])
  return await call(token, "balanceOf", [self]);
}

function _sqrt(value) {
  if (value < 0n) throw new Error("Square root of negative number");
  if (value < 2n) return value;
  let x = value / 2n + 1n;
  let y = (x + value / x) / 2n;
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  return x;
}

// --- LMR-20 Methods (LP Tokens) ---

function _mint(to, value) {
  storage.totalSupply += value;
  storage.balances[to] = (storage.balances[to] || 0n) + value;
  emit("Transfer", {
    from: "0x0000000000000000000000000000000000000000",
    to,
    value,
  });
}

function _burn(from, value) {
  storage.totalSupply -= value;
  storage.balances[from] -= value;
  emit("Transfer", {
    from,
    to: "0x0000000000000000000000000000000000000000",
    value,
  });
}

async function transfer(to, value) {
  const val = BigInt(value);
  if (!storage.balances[msg.sender] || storage.balances[msg.sender] < val)
    throw new Error("Insufficient balance");
  storage.balances[msg.sender] -= val;
  storage.balances[to] = (storage.balances[to] || 0n) + val;
  emit("Transfer", { from: msg.sender, to, value: val });
  return true;
}

async function approve(spender, value) {
  const val = BigInt(value);
  if (!storage.allowances[msg.sender]) storage.allowances[msg.sender] = {};
  storage.allowances[msg.sender][spender] = val;
  emit("Approval", { owner: msg.sender, spender, value: val });
  return true;
}

async function transferFrom(from, to, value) {
  const val = BigInt(value);
  const allowance = storage.allowances[from]
    ? storage.allowances[from][msg.sender] || 0n
    : 0n;
  if (allowance < val) throw new Error("Insufficient allowance");
  if (!storage.balances[from] || storage.balances[from] < val)
    throw new Error("Insufficient balance");

  storage.allowances[from][msg.sender] -= val;
  storage.balances[from] -= val;
  storage.balances[to] = (storage.balances[to] || 0n) + val;
  emit("Transfer", { from, to, value: val });
  return true;
}

function balanceOf(owner) {
  return storage.balances[owner] || 0n;
}

function allowance(owner, spender) {
  return storage.allowances[owner]
    ? storage.allowances[owner][spender] || 0n
    : 0n;
}
