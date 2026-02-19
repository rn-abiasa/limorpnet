import { useEffect, useState } from "react";
import Navbar from "@/components/navbar";
import { socket } from "@/lib/socket";
import { Coins, ExternalLink } from "lucide-react";

const Tokens = () => {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socket.on("tokens-res", (data: any[]) => {
      setTokens(data);
      setLoading(false);
    });

    socket.emit("get-tokens");

    return () => {
      socket.off("tokens-res");
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            Token Gallery
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <a href="/" className="hover:text-primary transition-colors">
              Home
            </a>
            <span>/</span>
            <span className="text-foreground font-medium">Tokens</span>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <button
            onClick={() => {
              setLoading(true);
              socket.emit("super-resync");
            }}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <ExternalLink className="w-3 h-3" /> Force Super Re-sync
          </button>
        </div>

        <div className="grid gap-6">
          <div className="bg-slate-900 rounded-xl p-8 text-white overflow-hidden relative border border-slate-800 shadow-xl">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                  Ecosystem Overview
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  Smart Contracts & Assets
                </h3>
                <p className="text-slate-400 mt-2 max-w-lg">
                  Browse all fungible tokens and smart contracts deployed on the
                  Limorp network, categorized by their implementation standards.
                </p>
              </div>
              <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <Coins className="text-blue-400 w-6 h-6" />
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Total Tracked</p>
                  <p className="text-2xl font-bold text-white">
                    {tokens.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="px-6 py-4">Token / Contract</th>
                    <th className="px-6 py-4">Standard</th>
                    <th className="px-6 py-4">Contract Address</th>
                    <th className="px-6 py-4">Deployment</th>
                    <th className="px-6 py-4 text-right">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-muted-foreground"
                      >
                        Loading on-chain assets...
                      </td>
                    </tr>
                  ) : tokens.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-muted-foreground"
                      >
                        No smart contracts indexed yet.
                      </td>
                    </tr>
                  ) : (
                    tokens.map((token, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${
                                token.symbol
                                  ? "bg-blue-500/10 text-blue-600 border-blue-200"
                                  : "bg-slate-500/10 text-slate-600 border-slate-200"
                              }`}
                            >
                              {token.symbol ? (
                                token.symbol[0]
                              ) : (
                                <Coins className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">
                                {token.name || "Smart Contract"}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {token.symbol || "N/A"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              token.standard === "LMR-20"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {token.standard}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                            {token.address}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(token.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <a
                            href={`/address/${token.address}`}
                            className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 font-medium"
                          >
                            Details <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © 2026 Limorp Scanner. Ecosystem Explorer.
        </div>
      </footer>
    </div>
  );
};

export default Tokens;
