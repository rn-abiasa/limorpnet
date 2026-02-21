import { ArrowRight, FileText, ChevronRight } from "lucide-react";
import { formatLMR } from "@/lib/utils";

const LatestTransactions = ({ transactions = [] }: { transactions: any[] }) => {
  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center bg-muted/30">
        <h2 className="font-semibold">Latest Transactions</h2>
        <a
          href="/txs"
          className="text-xs font-medium text-blue-500 hover:underline"
        >
          View All
        </a>
      </div>
      <div className="divide-y">
        {transactions.length === 0 && (
          <p className="p-8 text-center text-muted-foreground italic text-sm">
            No recent transactions...
          </p>
        )}
        {transactions.map((tx, i) => (
          <div
            key={tx.hash || i}
            className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-muted/50 transition-colors group gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <a
                  href={`/tx/${tx.hash}`}
                  className="text-sm font-mono font-medium text-blue-500 hover:underline block truncate w-32"
                >
                  {tx.hash}
                </a>
              </div>
            </div>

            <div className="flex flex-1 items-center gap-2 text-xs sm:text-sm overflow-hidden">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-slate-400 font-medium">From</span>
                <a
                  href={`/address/${tx.from}`}
                  className="text-blue-500 truncate hover:underline font-mono w-24 sm:w-32"
                >
                  {tx.from}
                </a>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-slate-400 font-medium">To</span>
                {tx.to ? (
                  <a
                    href={`/address/${tx.to}`}
                    className="text-blue-500 truncate hover:underline font-mono w-24 sm:w-32"
                  >
                    {tx.to}
                  </a>
                ) : (
                  <span className="text-slate-500 italic text-xs">
                    Contract Creation
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-4">
              <div className="text-right">
                <p className="text-sm font-bold">{formatLMR(tx.amount)} LMR</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LatestTransactions;
