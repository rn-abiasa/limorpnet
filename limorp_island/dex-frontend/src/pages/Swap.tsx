import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownUp, Settings } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useLimorpRPC } from "@/hooks/useLimorpRPC";
import { TokenSelector } from "@/components/TokenSelector";
import type { Token } from "@/hooks/useTokens";

const Swap = () => {
  const wallet = useWallet();
  const rpc = useLimorpRPC();

  const [mode, setMode] = useState<"swap" | "wrap">("swap");
  const [isWrapping, setIsWrapping] = useState(true); // if mode is wrap, true=LMR->WLMR, false=WLMR->LMR
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [tokenIn, setTokenIn] = useState<Token>({
    address: "0x91b0625cb583e6555c7eeb97f92dc0c9c6d82e7d",
    symbol: "WLMR",
    name: "Wrapped LMR",
    decimals: 18,
  });
  const [tokenOut, setTokenOut] = useState<Token>({
    address: "0x81aaaa8113a6d35975144b5cbba81f3324bfa125",
    symbol: "LUSD",
    name: "USD Limorp",
    decimals: 18,
  });
  const [reserves, setReserves] = useState<{ r0: bigint; r1: bigint } | null>(
    null,
  );

  // Production addresses
  const ROUTER = "0x7f8b1d90ae103b2d98cbe13e3bc9fb17c2d315d0";
  const FACTORY = "0x3321937306b612ca386007780f18c1b1bbecf664";
  const WLMR = "0x91b0625cb583e6555c7eeb97f92dc0c9c6d82e7d";

  const fetchState = async () => {
    if (!wallet?.address) return;

    // Fetch user balances
    await wallet.refreshBalances();

    // Fetch pool reserves (only for swap mode)
    if (mode === "swap") {
      const pair = await rpc.readContract(FACTORY, "getPair", [
        tokenIn.address,
        tokenOut.address,
      ]);
      if (pair && pair !== "0x0000000000000000000000000000000000000000") {
        const res = await rpc.readContract(pair, "getReserves");
        if (res) {
          // We need to know which reserve is which
          const t0 = await rpc.readContract(pair, "token0");
          if (t0.toLowerCase() === tokenIn.address.toLowerCase()) {
            setReserves({ r0: BigInt(res[0]), r1: BigInt(res[1]) });
          } else {
            setReserves({ r0: BigInt(res[1]), r1: BigInt(res[0]) });
          }
        }
      } else {
        setReserves(null);
      }
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 10000);
    return () => clearInterval(interval);
  }, [wallet?.address, rpc, mode]);

  useEffect(() => {
    if (mode === "swap") {
      if (amountIn && reserves) {
        const valIn = BigInt(
          Math.floor(parseFloat(amountIn) * 10 ** tokenIn.decimals),
        );
        const amountInWithFee = valIn * 997n;
        const numerator = amountInWithFee * reserves.r1;
        const denominator = reserves.r0 * 1000n + amountInWithFee;
        const valOut = numerator / denominator;
        setAmountOut((Number(valOut) / 10 ** tokenOut.decimals).toFixed(6));
      } else {
        setAmountOut("");
      }
    } else {
      // Wrap mode: 1 to 1
      setAmountOut(amountIn);
    }
  }, [amountIn, reserves, mode, isWrapping]);

  const handleAction = async () => {
    if (!wallet.isUnlocked) {
      alert("Please unlock your wallet first");
      return;
    }

    if (!amountIn) return;

    try {
      let hash;
      if (mode === "swap") {
        const valIn = BigInt(
          Math.floor(parseFloat(amountIn) * 10 ** tokenIn.decimals),
        ).toString();

        // Approve Router
        if (tokenIn.address !== "native") {
          await wallet.sendTransaction({
            to: tokenIn.address,
            type: "CALL",
            data: { method: "approve", args: [ROUTER, valIn] },
          });
        }

        const deadline = Math.floor(Date.now() / 1000) + 600;
        hash = await wallet.sendTransaction({
          to: ROUTER,
          type: "CALL",
          data: {
            method: "swapExactTokensForTokens",
            args: [
              valIn,
              "0",
              [tokenIn.address, tokenOut.address],
              wallet.address,
              deadline,
            ],
          },
          gasLimit: "1000000",
        });
      } else {
        if (isWrapping) {
          hash = await wallet.wrapLMR(amountIn);
        } else {
          hash = await wallet.unwrapLMR(amountIn);
        }
      }

      console.log("Transaction Hash:", hash);
      alert("Transaction submitted! Hash: " + hash.slice(0, 10) + "...");
      setAmountIn("");
    } catch (e: any) {
      console.error("Action failed:", e);
      alert("Error: " + (e.message || "Unknown error"));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-6">
      {/* Mode Selector */}
      <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 backdrop-blur-xl">
        <Button
          variant={mode === "swap" ? "secondary" : "ghost"}
          onClick={() => setMode("swap")}
          className="rounded-lg px-8"
        >
          Swap
        </Button>
        <Button
          variant={mode === "wrap" ? "secondary" : "ghost"}
          onClick={() => setMode("wrap")}
          className="rounded-lg px-8"
        >
          Wrap
        </Button>
      </div>

      <Card className="w-full max-w-md bg-zinc-900/50 border-zinc-800 backdrop-blur-xl shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            {mode === "swap" ? "Swap" : isWrapping ? "Wrap LMR" : "Unwrap LMR"}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input Area */}
          <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 space-y-2">
            <div className="flex justify-between text-sm text-zinc-400 pb-1">
              <span>{mode === "swap" ? "You pay" : "Amount"}</span>
              <span>
                Balance:{" "}
                {mode === "swap"
                  ? wallet.assets.find((a) => a.address === tokenIn.address)
                      ?.balance || "0"
                  : isWrapping
                    ? wallet.nativeBalance
                    : wallet.assets.find((a) => a.address === WLMR)?.balance ||
                      "0"}
              </span>
            </div>
            {mode === "swap" ? (
              <div className="space-y-3">
                <TokenSelector
                  selectedAddress={tokenIn.address}
                  onSelect={setTokenIn}
                  exclude={[tokenOut.address]}
                />
                <Input
                  type="number"
                  placeholder="0"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                  className="border-none bg-transparent text-2xl font-semibold focus-visible:ring-0 p-0"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                  className="border-none bg-transparent text-2xl font-semibold focus-visible:ring-0 p-0"
                />
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-700 rounded-full shrink-0">
                  <div
                    className={`w-5 h-5 rounded-full ${isWrapping ? "bg-emerald-500" : "bg-blue-500"}`}
                  />
                  <span className="font-medium">
                    {isWrapping ? "WLMR" : "LMR"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex justify-center -my-4 relative z-10">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (mode === "wrap") setIsWrapping(!isWrapping);
              }}
              className="rounded-xl bg-zinc-800 border-4 border-zinc-900 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-transform hover:rotate-180 duration-500"
            >
              <ArrowDownUp className="w-4 h-4" />
            </Button>
          </div>

          {/* Output Area */}
          <div className="flex justify-between text-sm text-zinc-400 pb-1">
            <span>{mode === "swap" ? "You receive" : "Estimated"}</span>
          </div>
          {mode === "swap" ? (
            <div className="space-y-3">
              <TokenSelector
                selectedAddress={tokenOut.address}
                onSelect={setTokenOut}
                exclude={[tokenIn.address]}
              />
              <Input
                type="number"
                placeholder="0"
                value={amountOut}
                readOnly
                className="border-none bg-transparent text-2xl font-semibold focus-visible:ring-0 p-0 cursor-default"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="0"
                value={amountOut}
                readOnly
                className="border-none bg-transparent text-2xl font-semibold focus-visible:ring-0 p-0 cursor-default"
              />
              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-700 rounded-full shrink-0">
                <div
                  className={`w-5 h-5 rounded-full ${mode === "swap" || isWrapping ? "bg-emerald-500" : "bg-blue-500"}`}
                />
                <span className="font-medium">
                  {mode === "swap"
                    ? tokenOut.symbol
                    : isWrapping
                      ? "WLMR"
                      : "LMR"}
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={handleAction}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-lg font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            {!wallet?.isConnected
              ? "Connect Wallet"
              : mode === "swap"
                ? "Swap"
                : isWrapping
                  ? "Wrap LMR"
                  : "Unwrap LMR"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Swap;
