import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Wallet } from "../../src/wallet/Wallet.js";
import { Transaction, TX_TYPE } from "../../src/core/transaction.js";
import { sha256, serialize } from "../../src/utils/crypto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Limorp Manual Deployment Tool
 * Edit the configuration below to deploy your contract.
 */

// --- Configuration ---
const CONTRACT_NAME = "LMR20"; // File in ./contracts/
const WALLET_NAME = "internal"; // File in ./wallets/
const INIT_ARGS = ["Limorp Gold", "LGOLD", 18, 1000];

const RPC_PORT = process.env.RPC_PORT || "3000";
const RPC_URL = `http://localhost:${RPC_PORT}`;

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
  console.log("🛠️  Limorp Deployment Tool (Manual Mode)");

  // 1. Resolve Paths
  const contractPath = path.join(__dirname, "contracts", `${CONTRACT_NAME}.js`);
  const walletPath = path.join(__dirname, "wallets", `${WALLET_NAME}.txt`);

  if (!fs.existsSync(contractPath)) {
    console.error(`❌ Contract not found: ${contractPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(walletPath)) {
    console.error(`❌ Wallet file not found: ${walletPath}`);
    console.log(
      `💡 Tip: Create a text file in ${path.join(__dirname, "wallets")} with your mnemonic.`,
    );
    process.exit(1);
  }

  try {
    // 2. Load Wallet
    const mnemonic = fs.readFileSync(walletPath, "utf8").trim();
    const wallet = Wallet.fromMnemonic(mnemonic);
    console.log(`📡 Wallet: ${wallet.address}`);

    // 3. Load Code
    const code = fs.readFileSync(contractPath, "utf8");
    console.log(
      `📦 Deploying: ${CONTRACT_NAME}.js with ${INIT_ARGS.length} args`,
    );

    // 4. Send Deployment Transaction
    const nonce = await rpc("getNonce", [wallet.address]);

    const txData = {
      from: wallet.address,
      to: "deploy",
      amount: "0",
      nonce,
      type: "DEPLOY",
      data: JSON.stringify({ code, args: INIT_ARGS }),
      fee: "1000000000000000", // 0.001 LMR
      timestamp: Date.now(),
    };

    const hash = sha256(serialize(txData));
    const signature = wallet.sign(hash);

    const result = await rpc("sendTransaction", [
      { ...txData, hash, signature },
    ]);

    console.log(`\n🚀 Success! Deployment hash: ${result.hash}`);
    console.log(`💡 Monitor your contract address in the block explorer.`);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
