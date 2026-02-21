/**
 * LMR20.js - Standard Fungible Token Template for Limorp
 */

async function init(name, symbol, decimals, initialSupply) {
  if (storage.initialized) throw new Error("Already initialized");

  storage.name = name;
  storage.symbol = symbol;
  storage.decimals = decimals;
  storage.totalSupply = BigInt(initialSupply);
  storage.balances = {};
  storage.allowances = {};

  // Assign initial supply to creator
  storage.balances[msg.sender] = BigInt(initialSupply);

  storage.initialized = true;
  emit("Transfer", {
    from: "0x0000000000000000000000000000000000000000",
    to: msg.sender,
    value: storage.totalSupply,
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
