import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatLMR } from "@/lib/utils";

const TransactionsList = ({ transactions = [] }: { transactions: any[] }) => {
  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg">Transactions</h2>
          <p className="text-xs text-muted-foreground">
            Latest transactions on the network
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-1 border rounded hover:bg-muted disabled:opacity-50"
            disabled
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium px-2">Page Control</span>
          <button className="p-1 border rounded hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
            <tr>
              <th className="px-4 py-3">Txn Hash</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 hidden md:table-cell">Method</th>
              <th className="px-4 py-3">Block</th>
              <th className="px-4 py-3 hidden lg:table-cell">Age</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((tx, idx) => (
              <tr
                key={idx}
                className="hover:bg-muted/50 transition-colors group"
              >
                <td className="px-4 py-4 text-center">
                  {tx.status === "success" ? (
                    <div className="flex justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  ) : tx.status === "failed" ? (
                    <div className="flex justify-center" title={tx.error}>
                      <XCircle className="w-4 h-4 text-rose-500" />
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 max-w-[120px] sm:max-w-none">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400 hidden sm:block" />
                    <a
                      href={`/tx/${tx.hash}`}
                      className="text-blue-500 w-40 hover:underline font-medium truncate"
                    >
                      {tx.hash}
                    </a>
                  </div>
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <span className="px-2 py-1 rounded-md bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200">
                    {tx.method || tx.type || "Transfer"}
                  </span>
                </td>
                <td className="px-4 py-4 text-blue-500 font-medium">
                  <a
                    href={`/block/${tx.blockHeight}`}
                    className="hover:underline"
                  >
                    {tx.blockHeight}
                  </a>
                </td>
                <td className="px-4 py-4 hidden lg:table-cell text-muted-foreground whitespace-nowrap">
                  {tx.time || "Confirmed"}
                </td>
                <td className="px-4 py-4">
                  <a
                    href={`/address/${tx.from}`}
                    className="text-blue-500 w-40 truncate hover:underline font-mono text-xs"
                  >
                    {tx.from}
                  </a>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <a
                      href={`/address/${tx.to}`}
                      className="text-blue-500 w-40 truncate hover:underline font-mono text-xs"
                    >
                      {tx.to}
                    </a>
                  </div>
                </td>
                <td className="px-4 py-4 text-right font-bold whitespace-nowrap">
                  <span className="text-slate-900">
                    {formatLMR(tx.amount)} LMR
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t bg-muted/10 flex justify-between items-center text-xs text-muted-foreground">
        <p>[ Showing latest on-chain transactions ]</p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border rounded hover:bg-muted">
            Next <ChevronRight className="inline w-3 h-3 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionsList;
