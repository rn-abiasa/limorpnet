import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Info, Droplets, ArrowLeft } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useLimorpRPC } from "@/hooks/useLimorpRPC";
import { TokenSelector } from "@/components/TokenSelector";
import type { Token } from "@/hooks/useTokens";

const WLMR = "0x91b0625cb583e6555c7eeb97f92dc0c9c6d82e7d";
const LUSD = "0x81aaaa8113a6d35975144b5cbba81f3324bfa125";
const FACTORY = "0x3321937306b612ca386007780f18c1b1bbecf664";
const ROUTER = "0x7f8b1d90ae103b2d98cbe13e3bc9fb17c2d315d0";

const Liquidity = () => {
  const wallet = useWallet();
  const rpc = useLimorpRPC();
  const [showAdd, setShowAdd] = useState(false);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [tokenA, setTokenA] = useState<Token>({
    address: "0x91b0625cb583e6555c7eeb97f92dc0c9c6d82e7d",
    symbol: "WLMR",
    name: "Wrapped LMR",
    decimals: 18,
  });
  const [tokenB, setTokenB] = useState<Token>({
    address: "0x81aaaa8113a6d35975144b5cbba81f3324bfa125",
    symbol: "LUSD",
    name: "USD Limorp",
    decimals: 18,
  });
  const [positions, setPositions] = useState<any[]>([]);

  const fetchPositions = useCallback(async () => {
    if (!wallet.address) return;
    try {
      const pair = await rpc.readContract(FACTORY, "getPair", [WLMR, LUSD]);
      if (pair && pair !== "0x0000000000000000000000000000000000000000") {
        const lpBalance = await rpc.readContract(pair, "balanceOf", [
          wallet.address,
        ]);
        if (lpBalance && BigInt(lpBalance) > 0n) {
          const res = await rpc.readContract(pair, "getReserves");
          const totalSupply = await rpc.readContract(pair, "totalSupply");
          const share = Number(lpBalance) / Number(totalSupply);

          setPositions([
            {
              pair,
              token0: "WLMR",
              token1: "LUSD",
              balance: (Number(lpBalance) / 1e18).toFixed(4),
              share: (share * 100).toFixed(2) + "%",
              pooled0: ((Number(res[0]) * share) / 1e18).toFixed(2),
              pooled1: ((Number(res[1]) * share) / 1e18).toFixed(2),
            },
          ]);
        } else {
          setPositions([]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch positions:", e);
    }
  }, [wallet.address, rpc]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 10000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  const handleAddLiquidity = async () => {
    if (!amountA || !amountB) return;
    try {
      // 1. Approve both tokens for Router
      const valA = BigInt(
        Math.floor(parseFloat(amountA) * 10 ** tokenA.decimals),
      ).toString();
      const valB = BigInt(
        Math.floor(parseFloat(amountB) * 10 ** tokenB.decimals),
      ).toString();

      if (tokenA.address !== "native") {
        await wallet.sendTransaction({
          to: tokenA.address,
          type: "CALL",
          data: { method: "approve", args: [ROUTER, valA] },
        });
      }

      if (tokenB.address !== "native") {
        await wallet.sendTransaction({
          to: tokenB.address,
          type: "CALL",
          data: { method: "approve", args: [ROUTER, valB] },
        });
      }

      // 2. Add Liquidity
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const hash = await wallet.sendTransaction({
        to: ROUTER,
        type: "CALL",
        data: {
          method: "addLiquidity",
          args: [
            tokenA.address,
            tokenB.address,
            valA,
            valB,
            "0",
            "0",
            wallet.address,
            deadline,
          ],
        },
      });

      alert("Liquidity added! Hash: " + hash);
      setShowAdd(false);
      setAmountA("");
      setAmountB("");
      fetchPositions();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  if (showAdd) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <Button
          variant="ghost"
          onClick={() => setShowAdd(false)}
          className="text-zinc-400 hover:text-white mb-4 -ml-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Add Liquidity</CardTitle>
            <CardDescription className="text-zinc-500">
              Select a pair and supply matching amounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-400">Token A</label>
              <TokenSelector
                selectedAddress={tokenA.address}
                onSelect={setTokenA}
                exclude={[tokenB.address]}
              />
              <Input
                type="number"
                placeholder="0.0"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
              />
            </div>
            <div className="flex justify-center py-2 h-10">
              <Plus className="w-5 h-5 text-zinc-600" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-400">Token B</label>
              <TokenSelector
                selectedAddress={tokenB.address}
                onSelect={setTokenB}
                exclude={[tokenA.address]}
              />
              <Input
                type="number"
                placeholder="0.0"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
              />
            </div>
            <Button
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 font-bold mt-4"
              onClick={handleAddLiquidity}
            >
              Supply Liquidity
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Liquidity
          </h1>
          <p className="text-zinc-400">
            Supply liquidity to pairs and earn 0.3% fees on all trades.
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 gap-2 h-12 px-6 font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Add Liquidity
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Droplets className="w-5 h-5 text-blue-400" />
              Your Positions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 rounded-full bg-zinc-800/50">
                  <Info className="w-8 h-8 text-zinc-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-white">
                    No liquidity found
                  </h3>
                  <p className="text-zinc-500 max-w-xs mx-auto">
                    Add liquidity to start earning fees.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {positions.map((p, i) => (
                  <div
                    key={i}
                    className="p-6 rounded-2xl bg-zinc-800/30 border border-zinc-800"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-zinc-900" />
                          <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-zinc-900" />
                        </div>
                        <h3 className="font-bold text-lg text-white">
                          {p.token0}/{p.token1}
                        </h3>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border-none">
                        {p.share} Share
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-zinc-500">Your Pool Share</span>
                        <div className="text-white font-medium">
                          {p.balance} LLP
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-zinc-500">Pooled Tokens</span>
                        <div className="text-white font-medium">
                          {p.pooled0} {p.token0} / {p.pooled1} {p.token1}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Liquidity;
