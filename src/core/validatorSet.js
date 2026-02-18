export default class ValidatorSet {
  constructor(balances) {
    this.balances = balances;
    this.validators = new Set();
  }

  register(address) {
    if (this.balances.getStake(address) <= 0n) throw new Error("No stake.");
    this.validators.add(address);
  }

  list() {
    return [...this.validators].map((addr) => ({
      address: addr,
      stake: this.balances.getStake(addr),
      online: true,
    }));
  }
}
