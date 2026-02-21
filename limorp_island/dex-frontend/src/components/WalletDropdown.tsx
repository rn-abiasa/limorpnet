import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Copy,
  Check,
  LogOut,
  ChevronDown,
  Coins,
  ArrowRight,
} from "lucide-react";

export const WalletDropdown = () => {
  const {
    address,
    isConnected,
    isUnlocked,
    vaultExists,
    totalBalanceWLMR,
    assets,
    initialize,
    importWallet,
    unlock,
    lock,
  } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "create" | "import" | "unlock">(
    "unlock",
  );
  const [password, setPassword] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [showMnemonic, setShowMnemonic] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleUnlock = async () => {
    const success = await unlock(password);
    if (success) {
      setPassword("");
      setError("");
    } else {
      setError("Invalid password");
    }
  };

  const handleCreate = async () => {
    if (password.length < 6) return setError("Password too short");
    const m = await initialize(password);
    setShowMnemonic(m);
    setPassword("");
  };

  const handleImport = async () => {
    if (password.length < 6) return setError("Password too short");
    try {
      await importWallet(mnemonic, password);
      setMnemonic("");
      setPassword("");
      setMode("menu");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="rounded-2xl bg-gradient-to-r from-blue-600/20 to-emerald-600/20 hover:from-blue-600/30 hover:to-emerald-600/30 border border-blue-500/30 text-white font-bold px-6 h-11 transition-all flex gap-2 items-center"
      >
        <Wallet className="w-4 h-4 text-emerald-400" />
        <span>
          {isConnected
            ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
            : "Connect Wallet"}
        </span>
        <ChevronDown className="w-4 h-4 opacity-50" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <div
        className="fixed inset-0 z-40"
        onClick={() => {
          setIsOpen(false);
          setMode("unlock");
          setError("");
        }}
      />
      <div className="absolute right-0 top-12 z-50 w-80 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
        {!vaultExists && mode !== "import" && mode !== "create" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                <Wallet className="text-blue-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">New to Limorp?</h3>
              <p className="text-zinc-500 text-sm mt-2">
                Create a secure internal wallet to start trading.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => setMode("create")}
                className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 font-bold"
              >
                Create New Wallet
              </Button>
              <Button
                onClick={() => setMode("import")}
                variant="outline"
                className="w-full rounded-2xl border-zinc-800 hover:bg-zinc-900 font-bold"
              >
                Restore Mnemonic
              </Button>
            </div>
          </div>
        )}

        {vaultExists && !isUnlocked && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold">Welcome Back</h3>
              <p className="text-zinc-500 text-sm mt-1">
                Unlock your DEX wallet
              </p>
            </div>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="Enter Password"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              />
              {error && (
                <p className="text-red-500 text-xs text-center font-bold">
                  {error}
                </p>
              )}
              <Button
                onClick={handleUnlock}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 font-bold"
              >
                Unlock
              </Button>
            </div>
          </div>
        )}

        {mode === "create" && !showMnemonic && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Set Password</h3>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="New Password (6+ chars)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                onClick={handleCreate}
                className="w-full rounded-2xl bg-blue-600"
              >
                Continue
              </Button>
              <Button
                variant="ghost"
                onClick={() => setMode("unlock")}
                className="w-full text-zinc-500"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {showMnemonic && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-emerald-500">Save this!</h3>
            <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 font-mono text-xs leading-relaxed text-zinc-300">
              {showMnemonic}
            </div>
            <Button
              onClick={() => setShowMnemonic("")}
              className="w-full rounded-2xl bg-white text-black font-bold"
            >
              I've Written It Down
            </Button>
          </div>
        )}

        {mode === "import" && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Import Wallet</h3>
            <div className="space-y-4">
              <textarea
                placeholder="Secret Recovery Phrase (12/24 words)"
                className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none text-sm font-mono"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
              />
              <input
                type="password"
                placeholder="Set New Password"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                onClick={handleImport}
                className="w-full rounded-2xl bg-blue-600"
              >
                Restore Account
              </Button>
            </div>
          </div>
        )}

        {isUnlocked && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div
                className="flex items-center gap-2 group cursor-pointer"
                onClick={() => copyToClipboard(address || "")}
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Coins className="text-emerald-500 w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    Address
                  </div>
                  <div className="text-xs font-bold flex items-center gap-1">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                    {copied ? (
                      <Check size={10} className="text-emerald-500" />
                    ) : (
                      <Copy size={10} className="text-zinc-600" />
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={lock}
                className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-red-400 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>

            <div className="bg-gradient-to-br from-zinc-900 to-black p-5 rounded-3xl border border-zinc-800 shadow-inner">
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mb-1">
                Portfolio Balance
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black">{totalBalanceWLMR}</span>
                <span className="text-sm font-bold text-emerald-500">WLMR</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  Your Assets
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {assets.map((asset) => (
                  <div
                    key={asset.address}
                    className="flex justify-between items-center p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                        {asset.symbol[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{asset.symbol}</div>
                        <div className="text-[10px] text-zinc-500">
                          {asset.balance} tokens
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">
                        {asset.valueInWLMR}
                      </div>
                      <div className="text-[9px] text-zinc-600 uppercase font-black">
                        WLMR VAL
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full rounded-2xl bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 font-bold text-xs flex justify-between group">
              Send Assets
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
