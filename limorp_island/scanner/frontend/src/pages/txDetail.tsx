import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Key,
  Database,
  TerminalSquare,
  Activity,
} from "lucide-react";
import Navbar from "@/components/navbar";
import { socket } from "@/lib/socket";
import { formatLMR, cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const TransactionDetail = () => {
  const { hash } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hash) return;
    setLoading(true);
    socket.emit("get-tx-info", hash);

    const handleTxDetails = (payload: any) => {
      // payload consists of { tx, receipt }
      if (payload?.tx?.hash === hash) {
        setData(payload);
        setLoading(false);
      } else if (!payload.tx) {
        setData(null);
        setLoading(false);
      }
    };

    socket.on("tx-details", handleTxDetails);

    return () => {
      socket.off("tx-details", handleTxDetails);
    };
  }, [hash]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 bg-blue-500/20 rounded-full mb-4"></div>
            <p className="text-muted-foreground">
              Fetching transaction data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.tx) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Transaction Not Found</h2>
          <p className="text-muted-foreground mb-6">
            We couldn't find a transaction with hash <br />
            <span className="font-mono text-sm">{hash}</span>
          </p>
          <Link to="/" className="text-blue-600 hover:underline">
            Go back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { tx, receipt } = data;
  const isSuccess = receipt?.status === 1 || receipt?.status === "success";

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <Link
            to="/txs"
            className="flex items-center gap-1 text-sm text-blue-500 hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Transactions
          </Link>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                Transaction Details
              </h1>
              <p className="text-sm font-mono text-muted-foreground break-all mt-1">
                {hash}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              Overview
            </h2>
            {receipt ? (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border",
                  isSuccess
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200",
                )}
              >
                {isSuccess ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {isSuccess ? "Success" : "Failed"}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border bg-amber-50 text-amber-700 border-amber-200">
                <Clock className="w-4 h-4 animate-spin-slow" /> Pending
              </div>
            )}
          </div>
          <div className="divide-y text-sm">
            {/* Type */}
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] p-5 hover:bg-slate-50/50 transition-colors">
              <div className="text-muted-foreground font-medium mb-1 md:mb-0">
                Transaction Type:
              </div>
              <div>
                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border bg-slate-100 text-slate-700">
                  {tx.type}
                </span>
              </div>
            </div>

            {/* Block & Time */}
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] p-5 hover:bg-slate-50/50 transition-colors">
              <div className="text-muted-foreground font-medium mb-1 md:mb-0">
                Block & Time:
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                {tx.blockHeight ? (
                  <Link
                    to={`/block/${tx.blockHeight}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    #{tx.blockHeight}
                  </Link>
                ) : (
                  <span className="text-amber-600 italic">Unconfirmed</span>
                )}
                {tx.timestamp && (
                  <>
                    <span className="hidden sm:inline text-slate-300">|</span>
                    <span className="text-slate-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDistanceToNow(new Date(tx.timestamp))} ago (
                      {new Date(tx.timestamp).toLocaleString()})
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* From -> To */}
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] p-5 hover:bg-slate-50/50 transition-colors">
              <div className="text-muted-foreground font-medium mb-1 md:mb-0">
                Route:
              </div>
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs font-semibold uppercase">
                    From
                  </span>
                  <Link
                    to={`/address/${tx.from}`}
                    className="text-blue-600 font-mono text-[13px] break-all hover:underline bg-blue-50 px-2 py-1 rounded block w-fit"
                  >
                    {tx.from}
                  </Link>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 hidden lg:block" />
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs font-semibold uppercase">
                    To
                  </span>
                  {tx.to ? (
                    <Link
                      to={`/address/${tx.to}`}
                      className="text-blue-600 font-mono text-[13px] break-all hover:underline bg-blue-50 px-2 py-1 rounded w-fit block"
                    >
                      {tx.to}
                    </Link>
                  ) : (
                    <span className="text-slate-500 italic bg-slate-100 px-2 py-1 rounded text-xs font-medium">
                      Contract Creation
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Value & Fee */}
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] p-5 bg-slate-50/30">
              <div className="text-muted-foreground font-medium mb-1 md:mb-0">
                Value & Fee:
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold w-12">
                    Value
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatLMR(tx.amount)} LMR
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-bold w-12">
                    Fee
                  </span>
                  <span className="text-slate-600">
                    {formatLMR(tx.fee)} LMR
                  </span>
                </div>
                {receipt?.gasUsed && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground w-12 text-center">
                      Gas Used
                    </span>
                    <span className="text-xs text-slate-500">
                      {receipt.gasUsed.toLocaleString()} units
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-800">Parameters</h2>
          </div>
          <div className="divide-y text-sm">
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] p-5 hover:bg-slate-50/50 transition-colors">
              <div className="text-muted-foreground font-medium mb-1 md:mb-0 flex items-center gap-2">
                <Key className="w-3.5 h-3.5" /> Nonce
              </div>
              <div className="font-mono text-slate-700">{tx.nonce}</div>
            </div>
            {tx.data && tx.data !== "" && (
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] p-5 hover:bg-slate-50/50 transition-colors">
                <div className="text-muted-foreground font-medium mb-2 md:mb-0 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" /> Input Data
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 overflow-x-auto text-[13px]">
                  <pre className="text-emerald-400 font-mono whitespace-pre-wrap break-all">
                    {tx.data}
                  </pre>
                </div>
              </div>
            )}
            {receipt?.error && (
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] p-5 bg-rose-50/50 overflow-x-auto">
                <div className="text-rose-700 font-medium mb-2 md:mb-0">
                  Error Message
                </div>
                <div className="text-rose-600 font-mono text-[13px]">
                  {receipt.error}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contract Logs / Events */}
        {receipt?.logs && receipt.logs.length > 0 && (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              <h2 className="font-semibold text-slate-800">
                Contract Logs ({receipt.logs.length})
              </h2>
            </div>
            <div className="divide-y">
              {receipt.logs.map((log: any, i: number) => (
                <div key={i} className="p-5 text-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded text-xs">
                      Log Index: {i}
                    </span>
                    <span className="text-slate-500 font-mono text-xs">
                      Contract:{" "}
                      <Link
                        to={`/address/${log.contract}`}
                        className="text-blue-500 hover:underline"
                      >
                        {log.contract}
                      </Link>
                    </span>
                  </div>
                  <div className="bg-slate-50 border rounded-lg p-3 font-mono text-[13px] text-slate-700 overflow-x-auto">
                    <span className="text-purple-600 font-bold">
                      {log.event}
                    </span>
                    (
                    <span className="text-slate-600">
                      {JSON.stringify(log.args, null, 2)}
                    </span>
                    )
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t bg-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © 2026 Limorp Scanner. Transaction Details View.
        </div>
      </footer>
    </div>
  );
};

export default TransactionDetail;
