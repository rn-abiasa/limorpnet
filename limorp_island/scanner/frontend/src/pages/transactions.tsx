import { useEffect, useState } from "react";
import Navbar from "@/components/navbar";
import TransactionsList from "@/components/transactionsList";
import { socket } from "@/lib/socket";

const Transactions = () => {
  const [data, setData] = useState<any>({
    stats: null,
    latestTransactions: [],
  });

  useEffect(() => {
    socket.on("dashboard-update", (payload: any) => {
      setData(payload);
    });

    return () => {
      socket.off("dashboard-update");
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            Transactions
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <a href="/" className="hover:text-primary transition-colors">
              Home
            </a>
            <span>/</span>
            <span className="text-foreground font-medium">Transactions</span>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="bg-slate-900 rounded-xl p-6 text-white overflow-hidden relative border border-slate-800 shadow-xl">
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                  Historical Data
                </p>
                <h3 className="text-xl font-bold mt-1">On-chain Activities</h3>
              </div>
              <div className="grid grid-cols-2 sm:flex gap-8">
                <div>
                  <p className="text-slate-500 text-xs">Mempool</p>
                  <p className="text-lg font-bold text-blue-400">
                    {data.stats?.mempool ?? "0"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">LMR Supply</p>
                  <p className="text-lg font-bold text-emerald-400 truncate max-w-[150px]">
                    {data.stats?.totalSupply
                      ? parseFloat(data.stats.totalSupply).toLocaleString()
                      : "..."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <TransactionsList transactions={data.latestTransactions} />
        </div>
      </main>

      <footer className="border-t bg-white py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © 2026 Limorp Scanner. Monitoring blockchain state.
        </div>
      </footer>
    </div>
  );
};

export default Transactions;
