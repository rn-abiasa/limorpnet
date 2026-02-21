console.log("[Limorp] Background script loading...");
import { Vault } from "../lib/vault";
import { Account } from "../lib/account";

console.log("[Limorp] Modules imported in background");

let currentAccount: Account | null = null;
let isLocked = true;

// Define message types
interface Message {
  type: string;
  payload?: any;
}

const RPC_URL = "http://localhost:3000";
const WS_RPC_URL = "ws://localhost:3000";

let ws: WebSocket | null = null;
let currentBalance = "0";
let pollInterval: any = null;

async function rpcCall(method: string, params: any[] = []) {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || data.error);
    return data.result;
  } catch (err: any) {
    console.error(`[Limorp] RPC Call Error (${method}):`, err.message);
    throw err;
  }
}

function setupWebSocket() {
  if (ws || isLocked || !currentAccount) return;

  console.log("[Limorp] 🔌 Connecting to Node WS:", WS_RPC_URL);
  ws = new WebSocket(WS_RPC_URL);

  ws.onopen = () => {
    console.log("[Limorp] ✅ WS connected");
    ws?.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "lmr_subscribe",
        params: ["newHeads"],
      }),
    );
    refreshBalance();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.method === "lmr_subscription") {
        console.log("[Limorp] 📥 New block detected via WS, refreshing...");
        refreshBalance();
      }
    } catch (e) {
      console.error("[Limorp] WS Message Error:", e);
    }
  };

  ws.onclose = () => {
    console.log("[Limorp] 🔌 WS disconnected, retrying in 5s...");
    ws = null;
    setTimeout(setupWebSocket, 5000);
  };

  ws.onerror = (err) => {
    console.error("[Limorp] ❌ WS Error:", err);
  };
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(refreshBalance, 5000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function refreshBalance() {
  if (!currentAccount || isLocked) return;
  try {
    const balance = await rpcCall("getBalance", [currentAccount.address]);
    if (balance !== currentBalance) {
      console.log(
        `[Limorp] 💰 Balance updated: ${currentBalance} -> ${balance} LMR`,
      );
      currentBalance = balance;
      chrome.runtime
        .sendMessage({
          type: "BALANCE_UPDATED",
          payload: { balance: currentBalance },
        })
        .catch(() => {});
    }
  } catch (e: any) {
    console.error("[Limorp] Failed to refresh balance:", e.message);
  }
}

async function broadcastToTabs(type: string, payload: any) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type, payload }).catch(() => {});
      }
    });
  });
}

/**
 * Handle messages from Popup or Content Script
 */
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (!message || !message.type) return false;
    console.log("[Limorp] Background handling message:", message.type);

    (async () => {
      try {
        switch (message.type) {
          case "GET_STATUS":
            const exists = await Vault.exists();
            if (!isLocked && currentAccount) {
              setupWebSocket();
              startPolling();
            }
            sendResponse({
              initialized: exists,
              unlocked: !isLocked && !!currentAccount,
              address: currentAccount?.address || null,
              balance: currentBalance,
            });
            break;

          case "INITIALIZE":
            // Create new wallet and encrypt with password
            const newAccount = Account.create();
            const encrypted = await Vault.encrypt(
              newAccount.mnemonic!,
              message.payload.password,
            );
            await Vault.save(encrypted);
            currentAccount = newAccount;
            isLocked = false;
            setupWebSocket();
            startPolling();
            refreshBalance();
            broadcastToTabs("ACCOUNTS_CHANGED", [currentAccount.address]);
            sendResponse({
              success: true,
              address: currentAccount.address,
              mnemonic: currentAccount.mnemonic,
            });
            break;

          case "UNLOCK":
            const vaultData = await Vault.load();
            if (!vaultData) {
              sendResponse({ error: "Vault not initialized" });
              return;
            }
            try {
              const mnemonic = await Vault.decrypt(
                vaultData,
                message.payload.password,
              );
              currentAccount = Account.fromMnemonic(mnemonic);
              isLocked = false;
              setupWebSocket();
              startPolling();
              refreshBalance();
              broadcastToTabs("ACCOUNTS_CHANGED", [currentAccount.address]);
              sendResponse({ success: true, address: currentAccount.address });
            } catch (e) {
              sendResponse({ error: "Invalid password" });
            }
            break;

          case "LOCK":
            currentAccount = null;
            isLocked = true;
            if (ws) {
              ws.close();
              ws = null;
            }
            stopPolling();
            broadcastToTabs("ACCOUNTS_CHANGED", []);
            sendResponse({ success: true });
            break;

          case "IMPORT":
            const importedAccount = message.payload.mnemonic
              ? Account.fromMnemonic(message.payload.mnemonic)
              : Account.fromPrivateKey(message.payload.privateKey);

            const encryptedImport = await Vault.encrypt(
              message.payload.mnemonic || importedAccount.privateKey,
              message.payload.password,
            );
            await Vault.save(encryptedImport);
            currentAccount = importedAccount;
            isLocked = false;
            setupWebSocket();
            startPolling();
            refreshBalance();
            broadcastToTabs("ACCOUNTS_CHANGED", [currentAccount.address]);
            sendResponse({ success: true, address: currentAccount.address });
            break;

          case "GET_MNEMONIC":
            if (isLocked || !currentAccount) {
              sendResponse({ error: "Wallet locked" });
              return;
            }
            const vData = await Vault.load();
            try {
              const decryptedMnemonic = await Vault.decrypt(
                vData!,
                message.payload.password,
              );
              sendResponse({ mnemonic: decryptedMnemonic });
            } catch (e) {
              sendResponse({ error: "Invalid password" });
            }
            break;

          case "SEND_TRANSACTION":
            if (isLocked || !currentAccount) {
              sendResponse({ error: "Wallet locked" });
              return;
            }
            const { to, amount: rawAmount } = message.payload;
            const nonceValue = await rpcCall("getNonce", [
              currentAccount.address,
            ]);

            const txBase = {
              from: currentAccount.address,
              to,
              amount: rawAmount.toString(),
              nonce: nonceValue,
              type: "TRANSFER",
              data: "",
              fee: "100",
              timestamp: Date.now(),
            };

            // Calculate hash exactly like RpcServer/Transaction does
            // RpcServer uses serialize(txBase) then sha256
            const sigHexStr = currentAccount.sign(txBase);
            // We need the hash to send it too
            const { sha256: cryptoSha256, serialize: cryptoSerialize } =
              await import("../lib/crypto");
            const finalHash = cryptoSha256(cryptoSerialize(txBase));

            const sendRes = await rpcCall("sendTransaction", [
              {
                ...txBase,
                signature: sigHexStr,
                hash: finalHash,
              },
            ]);

            sendResponse({ success: true, hash: sendRes.hash });
            break;

          case "SIGN_TX":
            if (isLocked || !currentAccount) {
              sendResponse({ error: "Wallet is locked" });
              return;
            }
            const signature = currentAccount.signHash(message.payload.hash);
            sendResponse({ signature });
            break;

          default:
            sendResponse({ error: "Unknown message type" });
        }
      } catch (err: any) {
        console.error("[Limorp] Background error handling message:", err);
        sendResponse({ error: err.message });
      }
    })();

    return true; // Keep channel open
  },
);

console.log("[Limorp] Background script fully initialized");
