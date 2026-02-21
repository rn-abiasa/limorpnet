import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useLimorpRPC } from "./useLimorpRPC";

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

const DEFAULT_TOKENS: Token[] = [
  {
    address: "native",
    symbol: "LMR",
    name: "Limorp",
    decimals: 18,
  },
  {
    address: "0x91b0625cb583e6555c7eeb97f92dc0c9c6d82e7d",
    symbol: "WLMR",
    name: "Wrapped LMR",
    decimals: 18,
  },
  {
    address: "0x81aaaa8113a6d35975144b5cbba81f3324bfa125",
    symbol: "LUSD",
    name: "USD Limorp",
    decimals: 18,
  },
];

const INDEXER_URL = "http://localhost:4001";

export const useTokens = () => {
  const [tokens, setTokens] = useState<Token[]>(DEFAULT_TOKENS);
  const rpc = useLimorpRPC();

  const fetchMetadata = useCallback(
    async (address: string): Promise<Token | null> => {
      if (address === "native") return DEFAULT_TOKENS[0];
      try {
        const [name, symbol, decimals] = await Promise.all([
          rpc.readContract(address, "name"),
          rpc.readContract(address, "symbol"),
          rpc.readContract(address, "decimals"),
        ]);

        return {
          address,
          name: name || "Unknown Token",
          symbol: symbol || "???",
          decimals: parseInt(decimals?.toString() || "18"),
        };
      } catch (e) {
        console.error(`Failed to fetch metadata for ${address}`, e);
        return null;
      }
    },
    [rpc.readContract],
  );

  const refreshTokens = useCallback(async () => {
    const discovered = new Map<string, Token>();
    DEFAULT_TOKENS.forEach((t) => discovered.set(t.address, t));

    try {
      // 1. Fetch from Indexer (Pairs)
      const res = await axios.get(`${INDEXER_URL}/pairs`);
      const pairs = res.data;

      const addressesToFetch: string[] = [];
      pairs.forEach((p: any) => {
        if (!discovered.has(p.token0)) addressesToFetch.push(p.token0);
        if (!discovered.has(p.token1)) addressesToFetch.push(p.token1);
      });

      // 2. Fetch from LocalStorage (User Deployed)
      const local = JSON.parse(
        localStorage.getItem("limorp_user_tokens") || "[]",
      );
      local.forEach((addr: string) => {
        if (!discovered.has(addr)) addressesToFetch.push(addr);
      });

      // Batch metadata fetch
      const metadata = await Promise.all(
        addressesToFetch.map((addr) => fetchMetadata(addr)),
      );
      metadata.forEach((m) => {
        if (m) discovered.set(m.address, m);
      });

      setTokens(Array.from(discovered.values()));
    } catch (e) {
      console.error("Failed to refresh tokens:", e);
    }
  }, [fetchMetadata]);

  useEffect(() => {
    refreshTokens();
    const interval = setInterval(refreshTokens, 30000);
    return () => clearInterval(interval);
  }, [refreshTokens]);

  const addLocalToken = (address: string) => {
    const local = JSON.parse(
      localStorage.getItem("limorp_user_tokens") || "[]",
    );
    if (!local.includes(address)) {
      local.push(address);
      localStorage.setItem("limorp_user_tokens", JSON.stringify(local));
      refreshTokens();
    }
  };

  return { tokens, refreshTokens, addLocalToken };
};
