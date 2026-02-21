import { ContractVM } from "../../../src/vm/ContractVM.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.join(__dirname, "../contracts/LMR20.js");

async function runTests() {
  const vm = new ContractVM();
  const code = fs.readFileSync(CONTRACT_PATH, "utf8");

  const owner = "0xOwner";
  const alice = "0xAlice";
  const bob = "0xBob";

  console.log("🚀 Starting LMR-20 Compliance Tests...\n");

  // 1. Test Deployment
  console.log("--- Test 1: Deployment ---");
  const deployCtx = {
    sender: owner,
    value: 0n,
    address: "0xContract",
    block: { number: 1, timestamp: Date.now() },
    storage: {},
    events: [],
  };

  const deployRes = await vm.deploy(code, {
    ...deployCtx,
    call: async () => ({ ok: true }), // Mock cross-calls
  });

  // Inject msg.args for init
  const initRes = await vm.call(
    code,
    { method: "init", args: ["Limorp Gold", "LGOLD", 18, 1000] },
    deployCtx,
  );

  if (!initRes.ok) throw new Error("Deploy/Init failed: " + initRes.error);

  let storage = initRes.storage;
  console.log(
    "✅ Contract initialized: " + storage.name + " (" + storage.symbol + ")",
  );
  console.log("✅ Initial supply: " + storage.totalSupply.toString());

  // 2. Test BalanceOf
  console.log("\n--- Test 2: BalanceOf ---");
  const balRes = await vm.call(
    code,
    { method: "balanceOf", args: [owner] },
    { ...deployCtx, storage },
  );
  console.log("Owner balance: " + balRes.result.toString());
  if (balRes.result !== storage.totalSupply)
    throw new Error("BalanceOf failed");
  console.log("✅ BalanceOf owner is correct");

  // 3. Test Transfer
  console.log("\n--- Test 3: Transfer ---");
  const transferAmount = 100n * 10n ** 18n;
  const transferRes = await vm.call(
    code,
    { method: "transfer", args: [alice, transferAmount.toString()] },
    { ...deployCtx, storage },
  );

  if (!transferRes.ok) throw new Error("Transfer failed: " + transferRes.error);
  storage = transferRes.storage;

  const aliceBal = await vm.call(
    code,
    { method: "balanceOf", args: [alice] },
    { ...deployCtx, storage },
  );
  console.log("Alice balance after transfer: " + aliceBal.result.toString());
  if (aliceBal.result !== transferAmount)
    throw new Error("Transfer target balance mismatch");
  console.log("✅ Transfer successful");

  // 4. Test Approve & TransferFrom
  console.log("\n--- Test 4: Approve & TransferFrom ---");
  const approveAmount = 50n * 10n ** 18n;
  const approveRes = await vm.call(
    code,
    { method: "approve", args: [bob, approveAmount.toString()] },
    { ...deployCtx, sender: alice, storage },
  );

  if (!approveRes.ok) throw new Error("Approve failed: " + approveRes.error);
  storage = approveRes.storage;
  console.log("✅ Alice approved Bob for " + approveAmount.toString());

  const transferFromRes = await vm.call(
    code,
    { method: "transferFrom", args: [alice, bob, approveAmount.toString()] },
    { ...deployCtx, sender: bob, storage },
  );

  if (!transferFromRes.ok)
    throw new Error("TransferFrom failed: " + transferFromRes.error);
  storage = transferFromRes.storage;

  const bobBal = await vm.call(
    code,
    { method: "balanceOf", args: [bob] },
    { ...deployCtx, storage },
  );
  console.log("Bob balance after transferFrom: " + bobBal.result.toString());
  if (bobBal.result !== approveAmount)
    throw new Error("TransferFrom target balance mismatch");
  console.log("✅ TransferFrom successful");

  // 5. Test Insufficient Balance
  console.log("\n--- Test 5: Insufficient Balance Rejection ---");
  const failRes = await vm.call(
    code,
    {
      method: "transfer",
      args: [alice, (storage.totalSupply * 2n).toString()],
    },
    { ...deployCtx, storage },
  );
  if (failRes.ok)
    throw new Error("Should have failed due to insufficient balance");
  console.log("✅ Correctly rejected: " + failRes.error);

  console.log("\n✨ All tests passed successfully!");
}

runTests().catch((err) => {
  console.error("\n❌ Test Failed:");
  console.error(err);
  process.exit(1);
});
