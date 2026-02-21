import fs from "fs";
import path from "path";
import { Wallet } from "../../src/wallet/Wallet.js";
import { Transaction, TX_TYPE } from "../../src/core/transaction.js";

/**
 * Limorp Smart Contract Deployment Tool
 * Usage: node index.js <code_path> <wallet_path> [json_args]
 */

const RPC_URL = process.env.RPC_URL || "http://localhost:3000";

async function rpc(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("\n� Limorp Contract Deployment Tool");
    console.log("Usage: node index.js <code_path> <wallet_path> [json_args]");
    console.log("\nArguments:");
    console.log("  code_path    Path to the contract .js file");
    console.log("  wallet_path  Path to the mnemonic .txt file");
    console.log(
      "  json_args    (Optional) Constructor arguments as JSON array",
    );
    console.log("\nExample:");
    console.log(
      '  node index.js ./contracts/LMR20.js ./wallets/admin.txt \'["MyToken", "MTK", 18, "1000"]\'\n',
    );
    process.exit(0);
  }

  const codePath = path.resolve(args[0]);
  const walletPath = path.resolve(args[1]);
  let initArgs = [];

  try {
    if (args[2]) initArgs = JSON.parse(args[2]);
  } catch (e) {
    console.error(
      "❌ Error parsing JSON arguments. Ensure they are in a valid JSON array format.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(codePath)) {
    console.error(`❌ Code file not found: ${codePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(walletPath)) {
    console.error(`❌ Wallet file not found: ${walletPath}`);
    process.exit(1);
  }

  try {
    // 1. Load Wallet
    const mnemonic = fs.readFileSync(walletPath, "utf8").trim();
    const wallet = Wallet.fromMnemonic(mnemonic);
    console.log(`📡 Deployer Address: ${wallet.address}`);

    // 2. Load Code
    const code = fs.readFileSync(codePath, "utf8");
    console.log(`📦 Preparing ${path.basename(codePath)} for deployment...`);

    // 3. Fetch Nonce
    const nonce = await rpc("getNonce", [wallet.address]);

    // 4. Construct Transaction
    const tx = new Transaction({
      from: wallet.address,
      to: null,
      amount: 0n,
      nonce,
      type: TX_TYPE.DEPLOY,
      data: JSON.stringify({ code, args: initArgs }),
      gasLimit: 5000000n,
      maxFeePerGas: 1000n,
      maxPriorityFeePerGas: 100n,
    });

    // 5. Sign Transaction
    wallet.signTransaction(tx);

    // 6. Send Transaction
    const result = await rpc("sendTransaction", [tx.toJSON()]);
    console.log(`\n🚀 Broadcast Successful!`);
    console.log(`Hash: ${result.hash}`);

    // 7. Wait for Receipt
    console.log("⏳ Waiting for transaction receipt...");
    let attempts = 0;
    while (attempts < 30) {
      try {
        const receipt = await rpc("getTransactionReceipt", [result.hash]);
        if (receipt) {
          if (receipt.status === "failed") {
            console.log(
              `\n❌ Deployment FAILED: ${receipt.error || "Unknown VM error"}`,
            );
          } else {
            console.log(`\n✅ Contract Deployed Successfully!`);
            console.log(`📍 Address: ${receipt.contractAddress}`);
          }
          return;
        }
      } catch (e) {
        // Ignore temporary RPC errors during polling
      }
      attempts++;
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.log(
      "\n⚠️ Timeout waiting for receipt. Transaction might still be processing.",
    );
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
