import Blockchain from "../core/chain.js";
import ValidatorSet from "../core/validatorSet.js";
import Balances from "../state/balances.js";
import Transaction from "../core/transaction.js";

const balances = new Balances();

balances.addBalance("alice", 1000000n);
balances.addBalance("bob", 5000000n);

balances.stake("alice", 500000n);
balances.stake("bob", 500000n);

const validators = new ValidatorSet(balances);

validators.register("alice");
validators.register("bob");

const chain = new Blockchain(validators);

chain.addTransaction(new Transaction("alice", "bob", 500n));
chain.addTransaction(new Transaction("bob", "alice", 1000000n));

const block = chain.produceBlock();

console.log(block);
