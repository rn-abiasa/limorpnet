import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLimorpRPC } from "@/hooks/useLimorpRPC";
import { useTokens, type Token } from "@/hooks/useTokens";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface TokenInfo extends Token {
  id: string;
  price: string;
  change: string;
  volume: string;
  cap: string;
}

const Tokens = () => {
  const navigate = useNavigate();
  const rpc = useLimorpRPC();
  const { tokens: discoveredTokens } = useTokens();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);

  const WLMR = "0x91b0625cb583e6555c7eeb97f92dc0c9c6d82e7d";
  const LUSD = "0x81aaaa8113a6d35975144b5cbba81f3324bfa125";
  const FACTORY = "0x3321937306b612ca386007780f18c1b1bbecf664";

  const fetchTokens = useCallback(async () => {
    try {
      // Get Pair for WLMR/LUSD
      const pair = await rpc.readContract(FACTORY, "getPair", [WLMR, LUSD]);
      let price = 1.0;

      if (pair && pair !== "0x0000000000000000000000000000000000000000") {
        const res = await rpc.readContract(pair, "getReserves");
        if (res && BigInt(res[0]) > 0n) {
          price = Number(res[1]) / Number(res[0]);
        }
      }

      // Fetch supplies (Mocked or real if available)
      const wlmrSupply = await rpc.readContract(WLMR, "totalSupply");
      const lusdSupply = await rpc.readContract(LUSD, "totalSupply");

      const lmrPrice = price.toFixed(2);

      const realTokens: TokenInfo[] = discoveredTokens.map((t, i) => {
        let displayPrice = "$0.00";
        let displayCap = "$0";

        if (t.symbol === "LMR" || t.symbol === "WLMR") {
          displayPrice = `$${lmrPrice}`;
          displayCap = `$${((Number(wlmrSupply || 0n) / 1e18) * price).toFixed(0)}`;
        } else if (t.symbol === "LUSD") {
          displayPrice = "$1.00";
          displayCap = `$${(Number(lusdSupply || 0n) / 1e18).toFixed(0)}`;
        }

        return {
          ...t,
          id: i.toString(),
          price: displayPrice,
          change: "0.0%",
          volume: "$0",
          cap: displayCap,
        };
      });
      setTokens(realTokens);
    } catch (e) {
      console.error("Failed to fetch tokens:", e);
    }
  }, [rpc]);

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 15000);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Top Tokens
        </h1>
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search tokens..."
            className="pl-10 bg-zinc-900/50 border-zinc-800 rounded-xl focus-visible:ring-emerald-500/50"
          />
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="w-12 text-zinc-400">#</TableHead>
              <TableHead className="text-zinc-400">Token</TableHead>
              <TableHead className="text-right text-zinc-400">Price</TableHead>
              <TableHead className="text-right text-zinc-400">Change</TableHead>
              <TableHead className="text-right text-zinc-400 hidden md:table-cell">
                Volume
              </TableHead>
              <TableHead className="text-right text-zinc-400 hidden lg:table-cell">
                Market Cap
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token, i) => (
              <TableRow
                key={token.id}
                className="border-zinc-800 hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/token/${token.symbol}`)}
              >
                <TableCell className="font-medium text-zinc-500">
                  {i + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-[10px] text-blue-400">
                      {token.symbol[0]}
                    </div>
                    <div>
                      <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {token.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {token.symbol}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {token.price}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      token.change.startsWith("+")
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  >
                    {token.change}
                  </span>
                </TableCell>
                <TableCell className="text-right text-zinc-300 hidden md:table-cell">
                  {token.volume}
                </TableCell>
                <TableCell className="text-right text-zinc-300 hidden lg:table-cell">
                  {token.cap}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Tokens;
