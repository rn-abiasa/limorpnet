/**
 * WLMR.js - Wrapped LMR Contract
 * Allows wrapping native LMR into an LMR20 token and vice versa.
 */

async function init(name, symbol, decimals) {
  if (storage.initialized) throw new Error("Already initialized");

  storage.name = name;
  storage.symbol = symbol;
  storage.decimals = decimals || 18;
  storage.totalSupply = 0n;
  storage.balances = {};
  storage.allowances = {};

  storage.initialized = true;
}

/**
 * Deposit native LMR to get WLMR
 * The amount is taken from msg.value
 */
async function deposit() {
  const amount = BigInt(msg.value || 0n);
  if (amount <= 0n) throw new Error("Deposit amount must be > 0");

  storage.balances[msg.sender] = (storage.balances[msg.sender] || 0n) + amount;
  storage.totalSupply += amount;

  emit("Deposit", { dst: msg.sender, wad: amount });
  emit("Transfer", {
    from: "0x0000000000000000000000000000000000000000",
    to: msg.sender,
    value: amount,
  });
}

/**
 * Withdraw native LMR by burning WLMR
 */
async function withdraw(wad) {
  const amount = BigInt(wad);
  if (!storage.balances[msg.sender] || storage.balances[msg.sender] < amount)
    throw new Error("Insufficient WLMR balance");

  storage.balances[msg.sender] -= amount;
  storage.totalSupply -= amount;

  // Transfer native LMR back to sender
  transfer(msg.sender, amount);

  emit("Withdrawal", { src: msg.sender, wad: amount });
  emit("Transfer", {
    from: msg.sender,
    to: "0x0000000000000000000000000000000000000000",
    value: amount,
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

function totalSupply() {
  return storage.totalSupply;
}
