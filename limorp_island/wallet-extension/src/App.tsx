import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  Lock,
  Plus,
  Download,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  Settings,
  ArrowUpRight,
  ArrowLeft,
  History,
  Trash2,
  Key,
} from "lucide-react";
import { formatLMR, parseLMR } from "./lib/utils";

const App: React.FC = () => {
  const [status, setStatus] = useState<{
    initialized: boolean;
    unlocked: boolean;
    address: string | null;
    balance: string;
  }>({
    initialized: false,
    unlocked: false,
    address: null,
    balance: "0",
  });
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<
    "status" | "import" | "mnemonic" | "settings" | "send"
  >("status");
  const [mnemonic, setMnemonic] = useState("");
  const [importText, setImportText] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [bgStatus, setBgStatus] = useState<"connected" | "disconnected">(
    "disconnected",
  );

  // Send Form State
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");

  // Settings State
  const [settingsView, setSettingsView] = useState<"menu" | "reveal">("menu");
  const [revealPassword, setRevealPassword] = useState("");
  const [revealedMnemonic, setRevealedMnemonic] = useState("");

  const fetchStatus = useCallback(() => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      if (chrome.runtime.lastError) {
        setBgStatus("disconnected");
        setLoading(false);
        return;
      }
      setBgStatus("connected");
      if (res) {
        setStatus(res);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);

    const listener = (message: any) => {
      if (message.type === "BALANCE_UPDATED") {
        console.log(
          "[Popup] Balance update received via push:",
          message.payload.balance,
        );
        setStatus((s) => ({ ...s, balance: message.payload.balance }));
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    return () => {
      clearInterval(interval);
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [fetchStatus]);

  const handleInitialize = () => {
    if (!password || password.length < 6)
      return setError("Password must be 6+ chars");
    setError("");
    setLoading(true);
    chrome.runtime.sendMessage(
      { type: "INITIALIZE", payload: { password } },
      (res) => {
        setLoading(false);
        if (res?.error) setError(res.error);
        else if (res) {
          setMnemonic(res.mnemonic || "");
          setView("mnemonic");
          fetchStatus();
        }
      },
    );
  };

  const handleImport = () => {
    if (!importText) return setError("Mnemonic/Key required");
    if (!password || password.length < 6)
      return setError("Password must be 6+ chars");
    setLoading(true);
    const text = importText.trim();
    const payload =
      text.split(/\s+/).length >= 12
        ? { mnemonic: text, password }
        : { privateKey: text, password };

    chrome.runtime.sendMessage({ type: "IMPORT", payload }, (res) => {
      setLoading(false);
      if (res?.error) setError(res.error);
      else {
        setView("status");
        fetchStatus();
      }
    });
  };

  const handleUnlock = () => {
    if (!password) return setError("Password required");
    setLoading(true);
    chrome.runtime.sendMessage(
      { type: "UNLOCK", payload: { password } },
      (res) => {
        setLoading(false);
        if (res?.error) setError(res.error);
        else {
          setPassword("");
          fetchStatus();
        }
      },
    );
  };

  const handleSend = () => {
    if (!sendTo || !sendAmount) return setError("Target and amount required");
    setLoading(true);
    const rawAmount = parseLMR(sendAmount);
    chrome.runtime.sendMessage(
      { type: "SEND_TRANSACTION", payload: { to: sendTo, amount: rawAmount } },
      (res) => {
        setLoading(false);
        if (res.error) {
          setError(res.error);
        } else {
          setSuccess(`Transaction sent! Hash: ${res.hash.slice(0, 8)}...`);
          setSendTo("");
          setSendAmount("");
          setTimeout(() => {
            setSuccess("");
            setView("status");
          }, 3000);
          fetchStatus();
        }
      },
    );
  };

  const handleRevealMnemonic = () => {
    if (!revealPassword) return setError("Password required");
    chrome.runtime.sendMessage(
      { type: "GET_MNEMONIC", payload: { password: revealPassword } },
      (res) => {
        if (res.error) setError(res.error);
        else {
          setRevealedMnemonic(res.mnemonic);
          setSettingsView("reveal");
          setRevealPassword("");
          setError("");
        }
      },
    );
  };

  const handleLock = () => {
    chrome.runtime.sendMessage({ type: "LOCK" }, () => {
      setView("status");
      fetchStatus();
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !status.initialized) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading Limorp...</p>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  if (status.initialized && status.unlocked && view === "status") {
    return (
      <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Wallet size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Limorp</h2>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Mainnet
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setView("settings")}
            className="p-2.5 hover:bg-slate-900 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <Settings size={20} />
          </button>
        </div>

        <div className="glass rounded-3xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Available Balance
            </span>
            <div
              className="flex items-center gap-2 group cursor-pointer"
              onClick={() => copyToClipboard(status.address || "")}
            >
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                {status.address?.slice(0, 6)}...{status.address?.slice(-4)}
              </span>
              {copied ? (
                <Check size={12} className="text-emerald-500" />
              ) : (
                <Copy
                  size={12}
                  className="text-slate-500 group-hover:text-blue-400"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col items-center py-4">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter">
                {formatLMR(status.balance)}
              </span>
              <span className="text-lg font-bold text-blue-500">LMR</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={() => setView("send")}
              className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm font-bold"
            >
              <Plus size={16} /> Send
            </button>
            <button className="flex items-center justify-center gap-2 py-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all text-sm font-bold shadow-lg shadow-blue-500/20 opacity-50 cursor-not-allowed">
              <Download size={16} /> Receive
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Recent Activity
            </h3>
            <History size={12} className="text-slate-600" />
          </div>
          <div className="flex flex-col items-center justify-center py-8 px-6 glass rounded-2xl text-center">
            <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-slate-700 mb-2 border border-slate-800">
              <History size={20} />
            </div>
            <p className="text-slate-500 text-[10px] font-medium">
              No transactions found
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-900 flex justify-center">
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
          >
            Explorer <ExternalLink size={10} />
          </a>
        </div>
      </div>
    );
  }

  // --- SEND VIEW ---
  if (view === "send") {
    return (
      <div className="w-full h-full flex flex-col bg-slate-950 p-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setView("status")}
            className="p-2 hover:bg-slate-900 rounded-xl text-slate-400 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-black">Send LMR</h2>
        </div>

        <div className="space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
              Recipient Address
            </label>
            <input
              type="text"
              className="w-full glass rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono placeholder:text-slate-700"
              placeholder="0x..."
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="flex justify-between items-center ml-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Amount
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                Bal: {formatLMR(status.balance)} LMR
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                className="w-full glass rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none text-2xl font-black pr-16"
                placeholder="0.0"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-blue-500">
                LMR
              </span>
            </div>
          </div>

          {error && (
            <p className="text-rose-500 text-xs font-bold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              {error}
            </p>
          )}
          {success && (
            <p className="text-emerald-400 text-xs font-bold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
              {success}
            </p>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={loading || !sendTo || !sendAmount}
          className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 mt-6 active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="animate-spin" size={20} />
          ) : (
            <>
              <ArrowUpRight size={20} /> Send Now
            </>
          )}
        </button>
      </div>
    );
  }

  // --- SETTINGS VIEW ---
  if (view === "settings") {
    return (
      <div className="w-full h-full flex flex-col bg-slate-950 p-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => {
              setView("status");
              setSettingsView("menu");
            }}
            className="p-2 hover:bg-slate-900 rounded-xl text-slate-400 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-black">Settings</h2>
        </div>

        {settingsView === "menu" ? (
          <div className="space-y-4">
            <button
              onClick={() => setSettingsView("reveal")}
              className="w-full flex items-center justify-between p-4 glass rounded-2xl hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                  <Key size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Secret Recovery Phrase</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-tighter">
                    View your backup words
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-600" />
            </button>

            <button className="w-full flex items-center justify-between p-4 glass rounded-2xl hover:bg-white/5 transition-colors group opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Plus size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Add New Account</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-tighter">
                    Create multiple addresses
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-600" />
            </button>

            <div className="pt-8 space-y-3">
              <button
                onClick={handleLock}
                className="w-full flex items-center justify-center gap-2 py-3 border border-slate-800 rounded-xl text-slate-400 font-bold text-xs hover:bg-white/5 transition-colors"
              >
                <Lock size={14} /> Lock Wallet
              </button>
              <button
                className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl font-bold text-xs transition-colors"
                onClick={() =>
                  alert("Feature to reset wallet is under development")
                }
              >
                <Trash2 size={14} /> Reset Wallet
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {!revealedMnemonic ? (
              <div className="space-y-6">
                <p className="text-slate-400 text-xs leading-relaxed">
                  Please enter your password to reveal your recovery phrase.
                  Keep it secret!
                </p>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Verify Password
                  </label>
                  <input
                    type="password"
                    className="w-full glass rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Enter master password"
                    value={revealPassword}
                    onChange={(e) => setRevealPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="text-rose-500 text-[10px] font-bold">{error}</p>
                )}
                <button
                  onClick={handleRevealMnemonic}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20"
                >
                  Confirm & Reveal
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-2 p-4 glass rounded-2xl font-mono text-[9px]">
                  {revealedMnemonic.split(" ").map((word, i) => (
                    <div
                      key={i}
                      className="flex gap-2 bg-slate-900/50 p-2 rounded-lg border border-white/5"
                    >
                      <span className="text-slate-600 w-3">{i + 1}</span>
                      <span className="text-white font-bold">{word}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setRevealedMnemonic("");
                    setSettingsView("menu");
                  }}
                  className="w-full py-3 bg-white text-black font-black rounded-xl"
                >
                  Close & Secure
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- IMPORT VIEW ---
  if (view === "import") {
    return (
      <div className="w-full h-full flex flex-col bg-slate-950 p-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setView("status")}
            className="p-2 hover:bg-slate-900 rounded-xl text-slate-400 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-black">Restore Account</h2>
        </div>

        <div className="space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
              Recovery Phrase or Key
            </label>
            <textarea
              className="w-full h-32 glass rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono placeholder:text-slate-700"
              placeholder="Enter 12/24 words or hex key..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full glass rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none pr-12"
                placeholder="6+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-rose-500 text-xs font-bold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              {error}
            </p>
          )}
        </div>

        <button
          onClick={handleImport}
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 mt-6 active:scale-95 disabled:opacity-50"
        >
          {loading ? "Restoring..." : "Restore Account"}
        </button>
      </div>
    );
  }

  // --- MNEMONIC VIEW ---
  if (view === "mnemonic") {
    return (
      <div className="w-full h-full flex flex-col bg-slate-950 p-8 overflow-y-auto">
        <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-600/30">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-black mb-3 text-white">
          Your Secret Phrase
        </h2>
        <p className="text-slate-400 text-[10px] mb-8 uppercase font-bold tracking-widest">
          Write these down.{" "}
          <span className="text-rose-400">Never share this.</span>
        </p>

        <div className="grid grid-cols-2 gap-2 p-4 glass rounded-2xl mb-8 font-mono text-[10px]">
          {mnemonic.split(" ").map((word, i) => (
            <div
              key={i}
              className="flex gap-2 bg-slate-900/50 p-2 rounded-lg border border-white/5"
            >
              <span className="text-slate-600 w-3">{i + 1}</span>
              <span className="text-white font-bold">{word}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setView("status");
            fetchStatus();
          }}
          className="w-full py-4 bg-white text-black font-black rounded-2xl active:scale-95"
        >
          I've saved it
        </button>
      </div>
    );
  }

  // --- LOCK SCREEN ---
  if (status.initialized && !status.unlocked) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-10 text-center">
        <div className="w-20 h-20 bg-blue-600/10 text-blue-500 rounded-[30px] flex items-center justify-center mb-8 glass">
          <Lock size={36} />
        </div>
        <h2 className="text-3xl font-black mb-2 text-white">Locked</h2>
        <p className="text-slate-500 text-sm mb-10 font-medium">
          Enter password to unlock Limorp.
        </p>

        <div className="w-full space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter Password"
              className="w-full glass rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none text-center pr-12"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && <p className="text-rose-500 text-xs font-bold">{error}</p>}
          <button
            onClick={handleUnlock}
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-2xl shadow-blue-600/20 active:scale-95"
          >
            {loading ? (
              <RefreshCw className="animate-spin inline" size={18} />
            ) : (
              "Unlock Wallet"
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- WELCOME ---
  return (
    <div className="w-full h-full flex flex-col bg-slate-950 p-10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px]" />

      <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
        <div className="w-20 h-20 bg-blue-600 text-white rounded-[32px] flex items-center justify-center shadow-2xl transform revolve-12 mb-10">
          <Wallet size={40} />
        </div>

        <h1 className="text-4xl font-black mb-2 text-white">Limorp</h1>
        <p className="text-slate-500 text-sm mb-12 font-medium">
          Decentralized Freedom.
        </p>

        <div className="w-full space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Set master password"
                className="w-full glass rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none text-center pr-12"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {error && (
              <p className="text-rose-500 text-xs font-bold">{error}</p>
            )}

            <button
              onClick={handleInitialize}
              disabled={loading || bgStatus === "disconnected"}
              className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50"
            >
              <Plus size={20} />
              <span>Create Wallet</span>
            </button>
          </div>

          <button
            className="flex items-center gap-2 py-3 px-6 text-slate-500 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all mx-auto"
            onClick={() => {
              setError("");
              setView("import");
            }}
          >
            <Download size={14} /> Restore from Mnemonic
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
