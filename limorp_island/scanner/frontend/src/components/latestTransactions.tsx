import { ArrowRight, FileText, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
            className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex p-2 rounded-lg bg-slate-500/10 text-slate-600">
                <FileText className="w-5 h-5" />
              </div>
              <div className="max-w-[100px] sm:max-w-none">
                <a
                  href={`/tx/${tx.hash}`}
                  className="font-medium text-blue-500 hover:underline block truncate"
                >
                  {tx.hash}
                </a>
                <p className="text-[10px] text-muted-foreground">
                  {tx.timestamp
                    ? formatDistanceToNow(new Date(tx.timestamp)) + " ago"
                    : "Confirmed"}
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="text-slate-500">From</span>
              <a
                href={`/address/${tx.from}`}
                className="font-medium text-blue-500 max-w-[80px] truncate"
              >
                {tx.from}
              </a>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-slate-500">To</span>
              <a
                href={`/address/${tx.to}`}
                className="font-medium text-blue-500 max-w-[80px] truncate"
              >
                {tx.to}
              </a>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[100px]">
                  {formatLMR(tx.amount)} LMR
                </p>
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
