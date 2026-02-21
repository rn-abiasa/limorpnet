import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rocket, ShieldCheck, Zap, Info } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useTokens } from "@/hooks/useTokens";

const LMR20_CODE = `/**
 * LMR20.js - Standard Fungible Token Template for Limorp
 */

async function init(name, symbol, decimals, initialSupply) {
  if (storage.initialized) throw new Error("Already initialized");

  storage.name = name;
  storage.symbol = symbol;
  storage.decimals = decimals;
  storage.totalSupply = BigInt(initialSupply);
  storage.balances = {};
  storage.allowances = {};

  // Assign initial supply to creator
  storage.balances[msg.sender] = BigInt(initialSupply);

  storage.initialized = true;
  emit("Transfer", {
    from: "0x0000000000000000000000000000000000000000",
    to: msg.sender,
    value: storage.totalSupply,
  });
}

async function transfer(to, value) {
  const val = BigInt(value);
  if (!storage.balances[msg.sender] || storage.balances[msg.sender] < val)
    throw new Error("Insufficient balance");

  storage.balances[msg.sender] -= val;
  storage.balances[to] = (storage.balances[to] || 0n) + val;

  emit("Transfer", { from: msg.sender, to, value: val });
  return true;
}

async function approve(spender, value) {
  const val = BigInt(value);
  if (!storage.allowances[msg.sender]) storage.allowances[msg.sender] = {};
  storage.allowances[msg.sender][spender] = val;

  emit("Approval", { owner: msg.sender, spender, value: val });
  return true;
}

async function transferFrom(from, to, value) {
  const val = BigInt(value);
  const allowance = storage.allowances[from]
    ? storage.allowances[from][msg.sender] || 0n
    : 0n;

  if (allowance < val) throw new Error("Insufficient allowance");
  if (!storage.balances[from] || storage.balances[from] < val)
    throw new Error("Insufficient balance");

  storage.allowances[from][msg.sender] -= val;
  storage.balances[from] -= val;
  storage.balances[to] = (storage.balances[to] || 0n) + val;

  emit("Transfer", { from, to, value: val });
  return true;
}

function balanceOf(owner) {
  return storage.balances[owner] || 0n;
}

function allowance(owner, spender) {
  return storage.allowances[owner]
    ? storage.allowances[owner][spender] || 0n
    : 0n;
}

function totalSupply() {
  return storage.totalSupply;
}`;

const Launchpad = () => {
  const wallet = useWallet();
  const { addLocalToken } = useTokens();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    decimals: "18",
    supply: "",
  });

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.address) {
      alert("Please connect your wallet first.");
      return;
    }

    setLoading(true);
    try {
      const supplyRaw =
        BigInt(formData.supply) * 10n ** BigInt(formData.decimals);

      const txData = {
        to: null,
        type: "DEPLOY",
        data: JSON.stringify({
          code: LMR20_CODE,
          args: [
            formData.name,
            formData.symbol,
            parseInt(formData.decimals),
            supplyRaw.toString(),
          ],
        }),
      };

      const hash = await wallet.sendTransaction(txData);
      setSuccess(hash);

      // Poll for receipt to get contract address and register it
      fetchReceipt(hash);
    } catch (err: any) {
      alert("Deployment failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceipt = async (hash: string) => {
    let attempts = 0;
    while (attempts < 20) {
      try {
        const res = await fetch("http://localhost:3000", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTransactionReceipt",
            params: [hash],
          }),
        });
        const json = await res.json();
        if (json.result && json.result.contractAddress) {
          setDeployedAddress(json.result.contractAddress);
          addLocalToken(json.result.contractAddress);
          return;
        }
      } catch (e) {}
      attempts++;
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  if (success) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-12 h-12 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Token Launched!</h1>
        <p className="text-zinc-400 mb-8">
          Your token is being deployed to the Limorp Mainnet. It will appear on
          the Tokens list shortly.
        </p>
        <Card className="bg-zinc-900/50 border-zinc-800 p-6 mb-8 text-left">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-sm text-zinc-500 mb-1">Transaction Hash</div>
              <div className="text-emerald-400 font-mono text-xs break-all">
                {success}
              </div>
            </div>
          </div>
          {deployedAddress && (
            <div className="pt-4 border-t border-zinc-800">
              <div className="text-sm text-zinc-500 mb-1">Contract Address</div>
              <div className="text-blue-400 font-mono text-xs break-all">
                {deployedAddress}
              </div>
            </div>
          )}
        </Card>
        <div className="flex gap-4 justify-center">
          <Button
            className="rounded-xl bg-zinc-800 hover:bg-zinc-700 h-12 px-6"
            onClick={() => navigate("/tokens")}
          >
            View Tokens
          </Button>
          <Button
            className="rounded-xl bg-blue-600 hover:bg-blue-500 h-12 px-6"
            onClick={() => setSuccess(null)}
          >
            Launch Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-12 items-start">
      <div className="space-y-8 py-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
            Token <span className="text-emerald-500">Launchpad</span>
          </h1>
          <p className="text-xl text-zinc-400">
            Create and deploy your own LMR-20 token in seconds. No coding
            required.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white">Instant Deployment</h3>
              <p className="text-sm text-zinc-500">
                Your token is live on the blockchain immediately after
                confirmation.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="p-3 rounded-2xl bg-emerald-600/20 text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white">LMR-20 Standard</h3>
              <p className="text-sm text-zinc-500">
                Fully compatible with the Limorp DEX, Explorer, and Wallet.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="p-3 rounded-2xl bg-zinc-800 text-zinc-400 shrink-0">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white">Initial Liquidity</h3>
              <p className="text-sm text-zinc-500">
                After launching, you can add liquidity to create a trading pair.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm overflow-hidden shadow-2xl">
        <CardHeader className="border-b border-zinc-800/50">
          <CardTitle className="text-white">Token Metadata</CardTitle>
          <CardDescription>
            Enter the details for your new token.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleDeploy} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-400">
                Token Name
              </label>
              <Input
                required
                placeholder="e.g. Limorp Gold"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="bg-zinc-800/50 border-zinc-700 h-12 rounded-xl text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-400">Symbol</label>
              <Input
                required
                placeholder="e.g. LGOLD"
                value={formData.symbol}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    symbol: e.target.value.toUpperCase(),
                  })
                }
                className="bg-zinc-800/50 border-zinc-700 h-12 rounded-xl text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-400">
                  Decimals
                </label>
                <Input
                  required
                  type="number"
                  value={formData.decimals}
                  onChange={(e) =>
                    setFormData({ ...formData, decimals: e.target.value })
                  }
                  className="bg-zinc-800/50 border-zinc-700 h-12 rounded-xl text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-400">
                  Initial Supply
                </label>
                <Input
                  required
                  type="number"
                  placeholder="1000000"
                  value={formData.supply}
                  onChange={(e) =>
                    setFormData({ ...formData, supply: e.target.value })
                  }
                  className="bg-zinc-800/50 border-zinc-700 h-12 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-600/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Deployment Fee</span>
                <span className="text-white font-bold">0.02 LMR</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-lg font-bold rounded-2xl gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
            >
              {loading ? (
                "Broadcasting..."
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Launch Token
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Launchpad;
