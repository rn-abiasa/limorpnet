/**
 * LMR-20 Reference Implementation
 * A standard for fungible tokens on the Limorp blockchain.
 */

// --- State Initialization ---
function init() {
  const name = msg.args[0] || "Limorp Token";
  const symbol = msg.args[1] || "LMR20";
  const decimals = msg.args[2] || 18;
  const initialSupply =
    BigInt(msg.args[3] || 1000000) * 10n ** BigInt(decimals);

  storage.name = name;
  storage.symbol = symbol;
  storage.decimals = decimals;
  storage.totalSupply = initialSupply;

  storage.balances = {};
  storage.allowances = {};

  // Mint initial supply to deployer
  storage.balances[msg.sender] = initialSupply;

  emit("Transfer", { from: null, to: msg.sender, value: initialSupply });
}

// --- Public Methods ---

function transfer(to, amount) {
  const value = BigInt(amount);
  const senderBalance = BigInt(storage.balances[msg.sender] || 0n);

  if (senderBalance < value) {
    throw new Error("Insufficient balance");
  }

  storage.balances[msg.sender] = senderBalance - value;
  storage.balances[to] = BigInt(storage.balances[to] || 0n) + value;

  emit("Transfer", { from: msg.sender, to: to, value: value });
  return true;
}

function approve(spender, amount) {
  const value = BigInt(amount);

  if (!storage.allowances[msg.sender]) {
    storage.allowances[msg.sender] = {};
  }

  storage.allowances[msg.sender][spender] = value;

  emit("Approval", { owner: msg.sender, spender: spender, value: value });
  return true;
}

function transferFrom(from, to, amount) {
  const value = BigInt(amount);
  const fromBalance = BigInt(storage.balances[from] || 0n);
  const spenderAllowance = BigInt(
    (storage.allowances[from] || {})[msg.sender] || 0n,
  );

  if (fromBalance < value) {
    throw new Error("Insufficient balance");
  }

  if (spenderAllowance < value) {
    throw new Error("Insufficient allowance");
  }

  storage.balances[from] = fromBalance - value;
  storage.balances[to] = BigInt(storage.balances[to] || 0n) + value;
  storage.allowances[from][msg.sender] = spenderAllowance - value;

  emit("Transfer", { from: from, to: to, value: value });
  return true;
}

function balanceOf(owner) {
  return BigInt(storage.balances[owner] || 0n);
}

function allowance(owner, spender) {
  return BigInt((storage.allowances[owner] || {})[spender] || 0n);
}

function totalSupply() {
  return storage.totalSupply;
}
