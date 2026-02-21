import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { Account } from "@/lib/wallet/Account";
import { Vault } from "@/lib/wallet/Vault";
import { sha256, serialize } from "@/lib/wallet/crypto";
import axios from "axios";

const RPC_URL = import.meta.env.VITE_RPC_URL || "http://localhost:3000";

interface Asset {
  symbol: string;
  address: string;
  balance: string;
  valueInWLMR: string;
  decimals: number;
}

interface WalletContextType {
  address: string | null;
  account: Account | null;
  nativeBalance: string;
  isConnected: boolean;
  isUnlocked: boolean;
  vaultExists: boolean;
  totalBalanceWLMR: string;
  assets: Asset[];
  initialize: (password: string) => Promise<string>;
  importWallet: (mnemonic: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  refreshBalances: () => Promise<void>;
  sendTransaction: (txData: any) => Promise<string>;
  wrapLMR: (amount: string) => Promise<string>;
  unwrapLMR: (amount: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | null>(null);

const WLMR = "0x91b0625cb583e6555c7eeb97f92dc0c9c6d82e7d";
const LUSD = "0x81aaaa8113a6d35975144b5cbba81f3324bfa125";
const FACTORY = "0x3321937306b612ca386007780f18c1b1bbecf664";

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultExists, setVaultExists] = useState(Vault.exists());
  const [nativeBalance, setNativeBalance] = useState("0");
  const [totalBalanceWLMR, setTotalBalanceWLMR] = useState("0");
  const [assets, setAssets] = useState<Asset[]>([]);

  const callRpc = useCallback(async (method: string, params: any[]) => {
    try {
      const payload = JSON.parse(
        JSON.stringify(
          {
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params,
          },
          (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
        ),
      );

      const res = await axios.post(RPC_URL, payload);
      if (res.data.error) throw new Error(res.data.error.message);
      return res.data.result;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message;
      throw new Error(`RPC Error (${method}): ${msg}`);
    }
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!address) return;

    try {
      // 1. Fetch Discovery List
      const [resNative, resPairs] = await Promise.all([
        callRpc("getBalance", [address]),
        axios.get(`http://localhost:4001/pairs`),
      ]);

      const pairTokens = new Set<string>();
      resPairs.data.forEach((p: any) => {
        pairTokens.add(p.token0);
        pairTokens.add(p.token1);
      });

      const local = JSON.parse(
        localStorage.getItem("limorp_user_tokens") || "[]",
      );
      const allAddresses = Array.from(
        new Set([WLMR, LUSD, ...pairTokens, ...local]),
      );

      // 2. Fetch Balances for all
      const balanceResults = await Promise.all(
        allAddresses.map((addr) => callRpc("getTokenBalance", [addr, address])),
      );

      const balNative = resNative;
      setNativeBalance((Number(balNative || 0) / 1e18).toFixed(4));

      // 3. Get Price (ReserveWLMR / ReserveLUSD) for portfolio valuation
      const pairAddr = await callRpc("callReadOnly", [
        FACTORY,
        { method: "getPair", args: [WLMR, LUSD] },
      ]);

      let priceLUSDInWLMR = 1;
      if (
        pairAddr &&
        pairAddr !== "0x0000000000000000000000000000000000000000"
      ) {
        const reserves = await callRpc("callReadOnly", [
          pairAddr,
          { method: "getReserves", args: [] },
        ]);
        if (reserves && BigInt(reserves._reserve1) > 0n) {
          priceLUSDInWLMR =
            Number(reserves._reserve0) / Number(reserves._reserve1);
        }
      }

      // 4. Map to Assets
      const newAssets: Asset[] = [];
      let totalValueWLMR = 0;

      for (let i = 0; i < allAddresses.length; i++) {
        const addr = allAddresses[i];
        const bal = BigInt(balanceResults[i] || 0);
        if (bal === 0n && addr !== WLMR && addr !== LUSD) continue;

        // Fetch symbol (simple cache/hardcode for core tokens)
        let symbol = addr === WLMR ? "WLMR" : addr === LUSD ? "LUSD" : "???";
        if (symbol === "???") {
          try {
            symbol = await callRpc("callReadOnly", [
              addr,
              { method: "symbol", args: [] },
            ]);
          } catch {
            symbol = addr.slice(0, 6);
          }
        }

        const balanceFormatted = (Number(bal) / 1e18).toFixed(2);
        let valueInWLMR = 0;

        if (addr === WLMR) valueInWLMR = Number(bal);
        else if (addr === LUSD) valueInWLMR = Number(bal) * priceLUSDInWLMR;

        totalValueWLMR += valueInWLMR;

        newAssets.push({
          symbol,
          address: addr,
          balance: balanceFormatted,
          valueInWLMR: (valueInWLMR / 1e18).toFixed(2),
          decimals: 18,
        });
      }

      setTotalBalanceWLMR((totalValueWLMR / 1e18).toFixed(4));
      setAssets(newAssets);
    } catch (error) {
      console.error("Failed to refresh balances:", error);
    }
  }, [address, callRpc]);

  useEffect(() => {
    if (isUnlocked) {
      refreshBalances();
      const interval = setInterval(refreshBalances, 10000);
      return () => clearInterval(interval);
    }
  }, [isUnlocked, refreshBalances]);

  const initialize = useCallback(async (password: string) => {
    const acc = Account.create();
    await Vault.encrypt(password, {
      mnemonic: acc.mnemonic,
      privateKey: acc.privateKey,
    });
    setAccount(acc);
    setAddress(acc.address);
    setIsUnlocked(true);
    setVaultExists(true);
    return acc.mnemonic!;
  }, []);

  const importWallet = useCallback(
    async (mnemonic: string, password: string) => {
      const acc = Account.fromMnemonic(mnemonic);
      await Vault.encrypt(password, {
        mnemonic: acc.mnemonic,
        privateKey: acc.privateKey,
      });
      setAccount(acc);
      setAddress(acc.address);
      setIsUnlocked(true);
      setVaultExists(true);
    },
    [],
  );

  const unlock = useCallback(async (password: string) => {
    const data = await Vault.decrypt(password);
    if (data) {
      const acc = data.mnemonic
        ? Account.fromMnemonic(data.mnemonic)
        : Account.fromPrivateKey(data.privateKey);
      setAccount(acc);
      setAddress(acc.address);
      setIsUnlocked(true);
      return true;
    }
    return false;
  }, []);

  const lock = useCallback(() => {
    setAccount(null);
    setAddress(null);
    setIsUnlocked(false);
  }, []);

  const sendTransaction = useCallback(
    async (txData: any) => {
      if (!account || !address) throw new Error("Wallet not unlocked");
      const nonce = await callRpc("getNonce", [address]);
      const tx = {
        from: address,
        to: txData.to || null,
        amount: BigInt(txData.amount || 0),
        nonce,
        type: txData.type || "TRANSFER",
        data: txData.data || "",
        gasLimit: BigInt(txData.gasLimit || 1000000),
        maxFeePerGas: BigInt(txData.maxFeePerGas || 1000),
        maxPriorityFeePerGas: BigInt(txData.maxPriorityFeePerGas || 100),
        timestamp: Date.now(),
      };

      // Calculate hash deterministically
      const hash = sha256(serialize(tx));
      const signature = account.signHash(hash);

      const res = await callRpc("sendTransaction", [
        { ...tx, signature, hash },
      ]);
      return res.hash;
    },
    [account, address, callRpc],
  );

  const wrapLMR = useCallback(
    async (amount: string) => {
      if (!account) throw new Error("Wallet not unlocked");
      const val = BigInt(Math.floor(Number(amount) * 1e18));
      return await sendTransaction({
        to: WLMR,
        amount: val,
        type: "CALL",
        data: { method: "deposit", args: [] },
      });
    },
    [account, sendTransaction],
  );

  const unwrapLMR = useCallback(
    async (amount: string) => {
      if (!account) throw new Error("Wallet not unlocked");
      const val = BigInt(Math.floor(Number(amount) * 1e18));
      return await sendTransaction({
        to: WLMR,
        amount: 0n,
        type: "CALL",
        data: { method: "withdraw", args: [val] },
      });
    },
    [account, sendTransaction],
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        account,
        nativeBalance,
        isConnected: !!address,
        isUnlocked,
        vaultExists,
        totalBalanceWLMR,
        assets,
        initialize,
        importWallet,
        unlock,
        lock,
        refreshBalances,
        sendTransaction,
        wrapLMR,
        unwrapLMR,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within WalletProvider");
  return context;
};
