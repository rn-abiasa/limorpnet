import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  History,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Navbar from "@/components/navbar";
import { socket } from "@/lib/socket";
import { formatLMR, cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const AddressDetail = () => {
  const { address } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transactions");

  useEffect(() => {
    if (!address) return;
    const normalizedAddress = address.toLowerCase();
    setLoading(true);
    socket.emit("get-address-info", normalizedAddress);

    const handleAddressDetails = (payload: any) => {
      if (payload.address?.toLowerCase() === normalizedAddress) {
        setData(payload);
        setLoading(false);
      }
    };

    socket.on("address-details", handleAddressDetails);

    return () => {
      socket.off("address-details", handleAddressDetails);
    };
  }, [address]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 bg-blue-500/20 rounded-full mb-4"></div>
            <p className="text-muted-foreground">Fetching account data...</p>
          </div>
        </div>
      </div>
    );
  }

  const { account, history } = data || {};

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            to="/"
            className="flex items-center gap-1 text-sm text-blue-500 hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">Address</h1>
                  {account?.code ? (
                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full border border-purple-200 font-bold">
                      Contract
                    </span>
                  ) : null}
                </div>
                <p className="text-sm font-mono text-muted-foreground break-all">
                  {address}
                </p>
              </div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-6">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                  Native Coin Balance
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {formatLMR(BigInt(account?.balance || 0))} LMR
                </p>
              </div>
              <div className="w-px h-8 bg-slate-100 hidden sm:block"></div>
              <div className="hidden sm:block">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                  Staked
                </p>
                <p className="text-sm font-semibold text-slate-600">
                  {formatLMR(account?.stake || 0)} LMR
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("transactions")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative",
              activeTab === "transactions"
                ? "text-blue-600"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4" /> Transactions
            </span>
            {activeTab === "transactions" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("tokens")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative",
              activeTab === "tokens"
                ? "text-blue-600"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <Coins className="w-4 h-4" /> Tokens & Info
            </span>
            {activeTab === "tokens" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "transactions" ? (
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h2 className="font-semibold">Transaction History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="px-4 py-3">Tx Hash</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Block</th>
                    <th className="px-4 py-3">Age</th>
                    <th className="px-4 py-3">Direction</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history?.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-muted-foreground italic"
                      >
                        No transactions found for this address.
                      </td>
                    </tr>
                  )}
                  {history?.map((tx: any, idx: number) => {
                    const isOutgoing = tx.from === address;
                    return (
                      <tr key={tx.hash || idx} className="hover:bg-muted/30">
                        <td className="px-4 py-4 font-mono text-xs text-blue-500 max-w-[120px] truncate">
                          <Link
                            to={`/tx/${tx.hash}`}
                            className="hover:underline"
                          >
                            {tx.hash}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          {tx.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : tx.status === "failed" ? (
                            <div title={tx.error}>
                              <XCircle className="w-4 h-4 text-rose-500" />
                            </div>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-slate-50 text-slate-600">
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-blue-500">
                          <Link
                            to={`/block/${tx.blockIndex}`}
                            className="hover:underline"
                          >
                            #{tx.blockIndex}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground whitespace-nowrap text-xs">
                          {tx.timestamp
                            ? formatDistanceToNow(new Date(tx.timestamp)) +
                              " ago"
                            : "-"}
                        </td>
                        <td className="px-4 py-4">
                          {isOutgoing ? (
                            <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full w-fit">
                              <ArrowUpRight className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase">
                                Out
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                              <ArrowDownLeft className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase">
                                In
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-bold">
                          <span
                            className={cn(
                              isOutgoing
                                ? "text-slate-900"
                                : "text-emerald-600",
                            )}
                          >
                            {isOutgoing ? "-" : "+"}
                            {formatLMR(tx.amount)} LMR
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden h-fit">
              <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
                <Coins className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold">Token Balances</h2>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                      LMR
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        Limorp Native
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Protocol Coin
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-sm">
                    {formatLMR(account?.balance || 0)} LMR
                  </p>
                </div>

                {/* Dynamic Token List from Events */}
                {data.events?.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">
                      Contract Interactions & Assets
                    </p>
                    {/* Unique tokens based on contract address */}
                    {Array.from(
                      new Set(data.events.map((e: any) => e.contract)),
                    ).map((contractAddr: any) => {
                      const tokenEvents = data.events.filter(
                        (e: any) => e.contract === contractAddr,
                      );
                      // This is a simplified balance check for demonstration
                      return (
                        <div
                          key={contractAddr}
                          className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold italic">
                              <Coins className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-900">
                                Contract {contractAddr.slice(0, 8)}...
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {tokenEvents.length} Interaction(s)
                              </p>
                            </div>
                          </div>
                          <Link
                            to={`/address/${contractAddr}`}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            View Contract
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground mt-4 italic">
                    No other tokens found in this address.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-card border rounded-xl shadow-sm overflow-hidden h-fit">
              <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
                <Info className="w-5 h-5 text-slate-500" />
                <h2 className="font-semibold">Additional Info</h2>
              </div>
              <div className="divide-y text-sm">
                <div className="p-4 flex justify-between">
                  <span className="text-muted-foreground">Nonce</span>
                  <span className="font-mono">{account?.nonce || 0}</span>
                </div>
                <div className="p-4 flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span>{account?.hasCode ? "Contract" : "EOA (User)"}</span>
                </div>
                <div className="p-4 flex justify-between">
                  <span className="text-muted-foreground">Mined Rewards</span>
                  <span className="font-bold text-emerald-600">
                    +{formatLMR(account?.mined || 0)} LMR
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t bg-white py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © 2026 Limorp Scanner. Address Explorer View.
        </div>
      </footer>
    </div>
  );
};

export default AddressDetail;
