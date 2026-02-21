#!/usr/bin/env node
import {
  intro,
  outro,
  select,
  text,
  password as promptPassword,
  spinner,
  isCancel,
  cancel,
} from "@clack/prompts";
import chalk from "chalk";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { resolve } from "path";

import { Wallet } from "../wallet/Wallet.js";
import { KeyStore } from "../wallet/KeyStore.js";
import { Transaction, TX_TYPE } from "../core/transaction.js";

const DATA_DIR = process.env.DATA_DIR || "./data";

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function getKeystoreFiles() {
  if (!existsSync(DATA_DIR)) return [];
  const files = readdirSync(DATA_DIR);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      name: f.replace(/\.json$/, ""),
      path: resolve(DATA_DIR, f),
    }));
}

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

// --- Handlers ---

async function handleWalletSelect() {
  const files = getKeystoreFiles();
  if (files.length === 0) {
    console.log(
      chalk.red("❌ No wallets found. Please create or import one first."),
    );
    return null;
  }

  const selected = await select({
    message: "Select a wallet:",
    options: [
      ...files.map((f) => ({ label: `${f.name} (${f.path})`, value: f })),
      { label: "← Back", value: "back" },
    ],
  });

  if (isCancel(selected) || selected === "back") return null;

  const pwd = await promptPassword({
    message: `Enter password for ${selected.name}:`,
    mask: "*",
  });

  if (isCancel(pwd)) return null;

  const s = spinner();
  s.start("Unlocking wallet...");
  try {
    const wallet = KeyStore.load(selected.path, pwd);
    s.stop("Wallet unlocked!");
    return wallet;
  } catch (err) {
    s.stop("Failed to unlock wallet");
    throw err;
  }
}

async function handleBalance(wallet) {
  const s = spinner();
  s.start("Fetching balance...");
  try {
    const result = await rpc("getBalance", [wallet.address]);
    s.stop("Balance fetched");
    const lmr = (BigInt(result) / 10n ** 18n).toString();
    console.log(`\n💰 ${chalk.cyan("Address:")} ${wallet.address}`);
    console.log(
      `💵 ${chalk.green("Balance:")} ${chalk.bold.yellow(lmr + " LMR")} ${chalk.gray("(" + result + " wei)")}\n`,
    );
  } catch (err) {
    s.stop("Error fetching balance");
    throw err;
  }
}

async function handleSend(wallet) {
  console.log(`\n📤 ${chalk.cyan("From:")} ${wallet.address}`);

  const recipient = await text({
    message: "Recipient address:",
    validate: (val) => (!val ? "Recipient cannot be empty" : undefined),
  });
  if (isCancel(recipient)) return;

  const amount = await text({
    message: "Amount (LMR):",
    validate: (val) =>
      isNaN(Number(val)) || Number(val) <= 0 ? "Invalid amount" : undefined,
  });
  if (isCancel(amount)) return;

  const fee = await text({
    message: "Fee (LMR):",
    initialValue: "0.001",
    validate: (val) =>
      isNaN(Number(val)) || Number(val) < 0 ? "Invalid fee" : undefined,
  });
  if (isCancel(fee)) return;

  const s = spinner();
  s.start("Sending transaction...");
  try {
    const nonce = await rpc("getNonce", [wallet.address]);
    const amountWei = BigInt(Math.round(parseFloat(amount) * 1e18));
    const feeWei = BigInt(Math.round(parseFloat(fee) * 1e18));

    const gasLimit = 21000n;
    const maxFeePerGas = feeWei / gasLimit;

    const tx = new Transaction({
      from: wallet.address,
      to: recipient.trim(),
      amount: amountWei,
      nonce,
      type: TX_TYPE.TRANSFER,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas: maxFeePerGas / 10n,
    });

    wallet.signTransaction(tx);
    const txResult = await rpc("sendTransaction", [tx.toJSON()]);
    s.stop("Transaction sent successfully!");

    console.log(`\n✅ ${chalk.green("Hash:")} ${chalk.cyan(txResult.hash)}`);
    console.log(`↗️  ${chalk.gray("To:")} ${recipient}`);
    console.log(`💲 ${chalk.gray("Amount:")} ${amount} LMR\n`);
  } catch (err) {
    s.stop("Transaction failed");
    throw err;
  }
}

async function handleStake(wallet) {
  console.log(`\n🔒 ${chalk.cyan("Validator:")} ${wallet.address}`);

  const amount = await text({
    message: "Stake Amount (LMR):",
    validate: (val) =>
      isNaN(Number(val)) || Number(val) <= 0 ? "Invalid amount" : undefined,
  });
  if (isCancel(amount)) return;

  const s = spinner();
  s.start("Staking...");
  try {
    const nonce = await rpc("getNonce", [wallet.address]);
    const amountWei = BigInt(Math.round(parseFloat(amount) * 1e18));

    const tx = new Transaction({
      from: wallet.address,
      to: wallet.address,
      amount: amountWei,
      nonce,
      type: TX_TYPE.STAKE,
      gasLimit: 21000n,
      maxFeePerGas: 1000n,
      maxPriorityFeePerGas: 100n,
    });

    wallet.signTransaction(tx);
    const txResult = await rpc("sendTransaction", [tx.toJSON()]);
    s.stop("Stake transaction sent successfully!");

    console.log(`\n✅ ${chalk.green("Hash:")} ${chalk.cyan(txResult.hash)}`);
    console.log(`🥩 ${chalk.gray("Amount:")} ${amount} LMR\n`);
  } catch (err) {
    s.stop("Stake failed");
    throw err;
  }
}

async function handleCreateWallet() {
  const s = spinner();
  s.start("Generating wallet...");
  const wallet = Wallet.create();
  s.stop("Wallet generated!");

  console.log(`\n✅ ${chalk.green.bold("Wallet created!")}`);
  console.log(`📬 ${chalk.gray("Address:")} ${chalk.cyan(wallet.address)}`);
  console.log(
    `🔑 ${chalk.gray("Mnemonic:")}\n${chalk.yellow.bold(wallet.mnemonic)}\n`,
  );
  console.log(chalk.red.bold("⚠️  Save your mnemonic securely!\n"));

  const saveChoice = await select({
    message: "Save to keystore?",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  });

  if (isCancel(saveChoice) || saveChoice === "no") return;

  const filename = await text({
    message: "Keystore filename (without .json):",
    validate: (val) => (!val ? "Filename required" : undefined),
  });
  if (isCancel(filename)) return;

  const pwd = await promptPassword({
    message: "Enter password to encrypt keystore:",
    mask: "*",
    validate: (val) => (!val ? "Password required" : undefined),
  });
  if (isCancel(pwd)) return;

  const path = resolve(DATA_DIR, `${filename}.json`);
  KeyStore.save(wallet, path, pwd);
  console.log(`\n💾 ${chalk.green(`Saved to ${path}`)}\n`);
}

async function handleImportWallet() {
  const mnemonic = await text({
    message: "Enter mnemonic:",
    validate: (val) => (!val ? "Mnemonic cannot be empty" : undefined),
  });
  if (isCancel(mnemonic)) return;

  let wallet;
  try {
    wallet = Wallet.fromMnemonic(mnemonic.trim());
    console.log(`\n✅ ${chalk.green.bold("Wallet imported!")}`);
    console.log(`📬 ${chalk.gray("Address:")} ${chalk.cyan(wallet.address)}\n`);
  } catch (err) {
    console.log(chalk.red(`❌ Error importing wallet: ${err.message}`));
    return;
  }

  const saveChoice = await select({
    message: "Save to keystore?",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  });

  if (isCancel(saveChoice) || saveChoice === "no") return;

  const filename = await text({
    message: "Keystore filename (without .json):",
    validate: (val) => (!val ? "Filename required" : undefined),
  });
  if (isCancel(filename)) return;

  const pwd = await promptPassword({
    message: "Enter password to encrypt keystore:",
    mask: "*",
    validate: (val) => (!val ? "Password required" : undefined),
  });
  if (isCancel(pwd)) return;

  const path = resolve(DATA_DIR, `${filename}.json`);
  KeyStore.save(wallet, path, pwd);
  console.log(`\n💾 ${chalk.green(`Saved to ${path}`)}\n`);
}

async function handleNodeInfo() {
  const s = spinner();
  s.start("Fetching node info...");
  try {
    const info = await rpc("getNodeInfo");
    s.stop("Node info fetched");
    console.log(`\n📡 ${chalk.cyan.bold("Node Information")}`);
    console.log(`🔗 ${chalk.gray("Chain ID:")} ${chalk.cyan(info.chainId)}`);
    console.log(`📏 ${chalk.gray("Height:")} ${chalk.cyan(info.height)}`);
    console.log(`🌍 ${chalk.gray("Peers:")} ${chalk.cyan(info.peers)}`);
    console.log(
      `📝 ${chalk.gray("Mempool:")} ${chalk.cyan(info.mempool)} txs\n`,
    );
  } catch (err) {
    s.stop("Failed to fetch node info");
    throw err;
  }
}

async function handleValidators() {
  const s = spinner();
  s.start("Fetching validators...");
  try {
    const validators = await rpc("getValidators");
    s.stop(`Found ${validators.length} validators`);
    console.log(
      `\n🏛️  ${chalk.cyan.bold(`Validators (${validators.length})`)}`,
    );
    validators.forEach((v, i) => {
      const stake = (BigInt(v.stake) / 10n ** 18n).toString();
      console.log(
        `   ${chalk.cyan(v.address)} ${chalk.gray("Stake:")} ${chalk.yellow(`${stake} LMR`)}`,
      );
    });
    console.log();
  } catch (err) {
    s.stop("Failed to fetch validators");
    throw err;
  }
}

async function handleGetBlock() {
  const inputParams = await text({
    message: "Enter block index or hash:",
    validate: (val) => (!val ? "Input required" : undefined),
  });
  if (isCancel(inputParams)) return;

  const s = spinner();
  s.start("Fetching block...");
  try {
    const block = await rpc("getBlock", [inputParams.trim()]);
    if (!block) {
      s.stop("Block not found");
      return;
    }
    s.stop("Block fetched");

    console.log(`\n📦 ${chalk.cyan.bold("Block Information")}`);
    console.log(`🔢 ${chalk.gray("Index:")} ${chalk.cyan(block.index)}`);
    console.log(`🆔 ${chalk.gray("Hash:")} ${chalk.cyan(block.hash)}`);
    console.log(
      `🧑‍⚖️ ${chalk.gray("Validator:")} ${chalk.cyan(block.validator)}`,
    );
    console.log(
      `🗃️  ${chalk.gray("Transactions:")} ${chalk.cyan(block.transactions.length)}`,
    );
    console.log(
      `⏱️  ${chalk.gray("Time:")} ${chalk.cyan(new Date(block.timestamp).toISOString())}\n`,
    );
  } catch (err) {
    s.stop("Failed to fetch block");
    throw err;
  }
}

// --- Main App ---

async function main() {
  console.clear();
  intro(chalk.bgCyan.black.bold(" 🌴 Limorp Blockchain CLI "));

  while (true) {
    const action = await select({
      message: "Select an option:",
      options: [
        { label: "💰 Check Balance", value: "balance" },
        { label: "💸 Send LMR", value: "send" },
        { label: "🔒 Stake LMR", value: "stake" },
        { label: "📡 Node Info", value: "nodeInfo" },
        { label: "🏛️ Validators", value: "validators" },
        { label: "📦 Get Block", value: "getBlock" },
        { label: "➕ Create Wallet", value: "createWallet" },
        { label: "📥 Import Wallet", value: "importWallet" },
        { label: "🚪 Exit", value: "exit" },
      ],
    });

    if (isCancel(action) || action === "exit") {
      outro(chalk.cyan("Goodbye! 👋"));
      process.exit(0);
    }

    try {
      if (action === "createWallet") {
        await handleCreateWallet();
      } else if (action === "importWallet") {
        await handleImportWallet();
      } else if (action === "nodeInfo") {
        await handleNodeInfo();
      } else if (action === "validators") {
        await handleValidators();
      } else if (action === "getBlock") {
        await handleGetBlock();
      } else {
        const wallet = await handleWalletSelect();
        if (!wallet) continue;

        if (action === "balance") {
          await handleBalance(wallet);
        } else if (action === "send") {
          await handleSend(wallet);
        } else if (action === "stake") {
          await handleStake(wallet);
        }
      }
    } catch (err) {
      console.error(chalk.red(`\n❌ Error: ${err.message}\n`));
    }
  }
}

main().catch((err) => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});
