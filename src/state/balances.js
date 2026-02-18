export default class Balances {
  constructor() {
    this.balances = {};
    this.stakes = {};
  }

  getBalance(addr) {
    return this.balances[addr] || 0n;
  }

  addBalance(addr, amount) {
    this.balances[addr] = this.getBalance(addr) + amount;
  }

  stake(addr, amount) {
    if (this.getBalance(addr) <= amount)
      throw new Error("Insufficient balance.");

    this.balances[addr] -= amount;
    this.stakes[addr] = (this.stakes[addr] || 0n) + amount;
  }

  getStake(addr) {
    return this.stakes[addr];
  }
}
