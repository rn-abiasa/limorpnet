import "dotenv/config";
import fs from "fs";
import path from "path";
import { Wallet } from "../src/wallet/Wallet.js";
import { sha256 } from "../src/utils/crypto.js";

/**
 * Standalone Deterministic Serialization (Matching Core)
 */
function serialize(obj) {
  const replacer = (_, v) => (typeof v === "bigint" ? v.toString() : v);
  const sortObject = (input) => {
    if (input === null || typeof input !== "object") return input;
    if (Array.isArray(input)) return input.map(sortObject);
    return Object.keys(input)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(input[key]);
        return acc;
      }, {});
  };
  return JSON.stringify(sortObject(obj), replacer);
}

const RPC_PORT = process.env.RPC_PORT || "3000";
const RPC_URL = `http://localhost:${RPC_PORT}`;
const BOT_DATA_PATH = "./bot_wallets.json";
const BOT_COUNT = 10;

const BOT_INTERVAL_MS = 0.1; // Delay base in milliseconds (3 seconds)

async function rpc(method, params = []) {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
  } catch (err) {
    console.error(`  [RPC ERROR] ${method}:`, err.message);
    return null;
  }
}

function loadOrGenerateBots() {
  if (fs.existsSync(BOT_DATA_PATH)) {
    const data = JSON.parse(fs.readFileSync(BOT_DATA_PATH, "utf8"));
    return data.map((w) => Wallet.fromMnemonic(w.mnemonic));
  }

  console.log("🛠️  Generating new bot swarm...");
  const bots = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    bots.push(Wallet.create());
  }
  fs.writeFileSync(
    BOT_DATA_PATH,
    JSON.stringify(
      bots.map((b) => ({ mnemonic: b.mnemonic, address: b.address }), null, 2),
    ),
  );
  return bots;
}

async function startBot() {
  const bots = loadOrGenerateBots();
  console.log("\n🚀 Limorp Bot Swarm Active!");
  console.log("------------------------------------------");
  bots.forEach((b, i) => console.log(`   Bot ${i + 1}: ${b.address}`));
  console.log("------------------------------------------");
  console.log(
    "💡 INSTRUCTION: Send some LMR to any address above to start the swarm.\n",
  );

  while (true) {
    for (const bot of bots) {
      try {
        const balanceWei = await rpc("getBalance", [bot.address]);
        if (balanceWei === null) continue;

        const balance = BigInt(balanceWei);
        const minToSend = 100000000000000000n; // 0.1 LMR

        if (balance > minToSend) {
          // Fund detected! Choose random target
          const otherBots = bots.filter((b) => b.address !== bot.address);
          const target =
            otherBots[Math.floor(Math.random() * otherBots.length)];

          // 1. Get Nonce
          const nonce = await rpc("getNonce", [bot.address]);
          if (nonce === null) continue;

          // 2. Construct TX Object (Standalone - No core imports)
          const amountWei = balance / 2n; // Send half

          const txData = {
            from: bot.address,
            to: target.address,
            amount: amountWei.toString(),
            nonce: nonce,
            type: "TRANSFER",
            data: "",
            gasLimit: "21000",
            maxFeePerGas: "1000",
            maxPriorityFeePerGas: "100",
            timestamp: Date.now(),
          };

          // 3. Hash and Sign
          const txHash = sha256(serialize(txData));
          const signature = bot.sign(txHash);

          const fullTx = { ...txData, hash: txHash, signature };

          // 4. Broadcast
          console.log(
            `📡 Bot ${bot.address.slice(-6)} sending ${Number(amountWei) / 1e18} LMR to ${target.address.slice(-6)}...`,
          );
          const result = await rpc("sendTransaction", [fullTx]);
          if (result) {
            console.log(`✅ Success! Hash: ${result.hash.slice(0, 10)}...`);
          }
        }
      } catch (err) {
        console.error("❌ Bot error:", err.message);
      }

      // Delay between bot actions
      await new Promise((r) =>
        setTimeout(r, BOT_INTERVAL_MS + Math.random() * 1000),
      );
    }
  }
}

startBot().catch(console.error);
