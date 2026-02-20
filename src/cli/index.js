#!/usr/bin/env node
import "dotenv/config";
import { createInterface } from "readline";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

import { Wallet } from "../wallet/Wallet.js";
import { KeyStore } from "../wallet/KeyStore.js";
import { Transaction, TX_TYPE } from "../core/transaction.js";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const DATA_DIR = process.env.DATA_DIR || "./data";

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Resolve keystore path dengan urutan:
 * 1. Path as-is (jika absolute atau relative dengan ./)
 * 2. Di dalam DATA_DIR
 * 3. Tambah .json extension
 */
function resolveKeystorePath(input) {
  const trimmed = input.trim();
  const candidates = [
    trimmed,
    resolve(trimmed),
    resolve(DATA_DIR, trimmed),
    resolve(DATA_DIR, `${trimmed}.json`),
    resolve(trimmed + ".json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // Tidak ditemukan — kembalikan path yang paling masuk akal untuk error message
  return resolve(
    DATA_DIR,
    trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`,
  );
}

console.clear();

async function rpc(method, params = []) {
  const port = process.env.RPC_PORT || "3000";
  const res = await fetch(`http://localhost:${port}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdCreateWallet() {
  const wallet = Wallet.create();
  console.log("\n✅ Wallet created!");
  console.log("   Address  :", wallet.address);
  console.log("   Mnemonic :", wallet.mnemonic);
  console.log("   ⚠️  Save your mnemonic securely!\n");

  const save = await ask("Save to keystore? (y/n): ");
  if (save.toLowerCase() === "y") {
    ensureDataDir();
    const name = await ask("Keystore filename (e.g. validator): ");
    const password = await ask("Password: ");
    const path = resolve(DATA_DIR, `${name}.json`);
    KeyStore.save(wallet, path, password);
    console.log(`✅ Saved to ${path}`);
  }
}

async function cmdImportWallet() {
  const mnemonic = await ask("Enter mnemonic: ");
  try {
    const wallet = Wallet.fromMnemonic(mnemonic.trim());
    console.log("\n✅ Wallet imported!");
    console.log("   Address:", wallet.address);

    const save = await ask("Save to keystore? (y/n): ");
    if (save.toLowerCase() === "y") {
      ensureDataDir();
      const name = await ask("Keystore filename: ");
      const password = await ask("Password: ");
      const path = resolve(DATA_DIR, `${name}.json`);
      KeyStore.save(wallet, path, password);
      console.log(`✅ Saved to ${path}`);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function cmdBalance() {
  const address = await ask("Address: ");
  try {
    const balance = await rpc("getBalance", [address.trim()]);
    const lmr = (BigInt(balance) / 10n ** 18n).toString();
    const wei = balance;
    console.log(`\n💰 Balance: ${lmr} LMR (${wei} wei)`);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function cmdSend() {
  const keystoreInput = await ask("Keystore path or name (e.g. validator): ");
  const password = await ask("Password: ");

  let wallet;
  try {
    const keystorePath = resolveKeystorePath(keystoreInput);
    wallet = KeyStore.load(keystorePath, password);
  } catch (err) {
    console.error("❌ Could not load wallet:", err.message);
    return;
  }

  const to = await ask("Recipient address: ");
  const amount = await ask("Amount (LMR): ");
  const fee = (await ask("Fee (LMR, default 0.001): ")) || "0.001";

  try {
    const nonce = await rpc("getNonce", [wallet.address]);
    const amountWei = BigInt(Math.round(parseFloat(amount) * 1e18));
    const feeWei = BigInt(Math.round(parseFloat(fee) * 1e18));

    const tx = new Transaction({
      from: wallet.address,
      to: to.trim(),
      amount: amountWei,
      nonce,
      type: TX_TYPE.TRANSFER,
      fee: feeWei,
    });

    wallet.signTransaction(tx);

    const result = await rpc("sendTransaction", [tx.toJSON()]);
    console.log(`\n✅ Transaction sent! Hash: ${result.hash}`);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function cmdStake() {
  const keystoreInput = await ask("Keystore path or name (e.g. validator): ");
  const password = await ask("Password: ");

  let wallet;
  try {
    const keystorePath = resolveKeystorePath(keystoreInput);
    wallet = KeyStore.load(keystorePath, password);
  } catch (err) {
    console.error("❌ Could not load wallet:", err.message);
    return;
  }

  const amount = await ask("Stake amount (LMR): ");

  try {
    const nonce = await rpc("getNonce", [wallet.address]);
    const amountWei = BigInt(Math.round(parseFloat(amount) * 1e18));

    const tx = new Transaction({
      from: wallet.address,
      to: wallet.address,
      amount: amountWei,
      nonce,
      type: TX_TYPE.STAKE,
      fee: 0n,
    });

    wallet.signTransaction(tx);
    const result = await rpc("sendTransaction", [tx.toJSON()]);
    console.log(`\n✅ Stake tx sent! Hash: ${result.hash}`);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function cmdNodeInfo() {
  try {
    const info = await rpc("getNodeInfo");
    console.log("\n📡 Node Info:");
    console.log("   Chain ID :", info.chainId);
    console.log("   Height   :", info.height);
    console.log("   Peers    :", info.peers);
    console.log("   Mempool  :", info.mempool, "txs");
  } catch (err) {
    console.error("❌ Node not reachable:", err.message);
  }
}

async function cmdValidators() {
  try {
    const validators = await rpc("getValidators");
    console.log(`\n🏛️  Validators (${validators.length}):`);
    for (const v of validators) {
      const stake = (BigInt(v.stake) / 10n ** 18n).toString();
      console.log(`   ${v.address}  stake: ${stake} LMR`);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

async function cmdGetBlock() {
  const input = await ask("Block index or hash: ");
  try {
    const block = await rpc("getBlock", [input.trim()]);
    if (!block) {
      console.log("Block not found");
      return;
    }
    console.log("\n📦 Block:");
    console.log("   Index    :", block.index);
    console.log("   Hash     :", block.hash);
    console.log("   Validator:", block.validator);
    console.log("   Txs      :", block.transactions.length);
    console.log("   Time     :", new Date(block.timestamp).toISOString());
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

// ─── Main Menu ───────────────────────────────────────────────────────────────

async function menu() {
  console.log("\n╔══════════════════════════════╗");
  console.log("║     Limorp Blockchain CLI    ║");
  console.log("╚══════════════════════════════╝");
  console.log("  1. Create wallet");
  console.log("  2. Import wallet");
  console.log("  3. Check balance");
  console.log("  4. Send LMR");
  console.log("  5. Stake LMR");
  console.log("  6. Node info");
  console.log("  7. List validators");
  console.log("  8. Get block");
  console.log("  0. Exit\n");

  const choice = await ask("Choose: ");

  switch (choice.trim()) {
    case "1":
      await cmdCreateWallet();
      break;
    case "2":
      await cmdImportWallet();
      break;
    case "3":
      await cmdBalance();
      break;
    case "4":
      await cmdSend();
      break;
    case "5":
      await cmdStake();
      break;
    case "6":
      await cmdNodeInfo();
      break;
    case "7":
      await cmdValidators();
      break;
    case "8":
      await cmdGetBlock();
      break;
    case "0":
      console.log("Bye!");
      rl.close();
      process.exit(0);
    default:
      console.log("Invalid choice");
  }

  await menu();
}

menu().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
