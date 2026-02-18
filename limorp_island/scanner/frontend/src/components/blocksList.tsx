import { Box, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { formatLMR } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const BlocksList = ({ blocks = [] }: { blocks: any[] }) => {
  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg">Blocks</h2>
          <p className="text-xs text-muted-foreground">
            Showing latest processed blocks on-chain
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 text-xs border rounded hover:bg-muted transition-colors disabled:opacity-50"
            disabled
          >
            First
          </button>
          <button
            className="p-1 border rounded hover:bg-muted transition-colors disabled:opacity-50"
            disabled
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium px-2">Live Data Feed</span>
          <button
            className="p-1 border rounded hover:bg-muted transition-colors"
            disabled
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            className="px-3 py-1 text-xs border rounded hover:bg-muted transition-colors"
            disabled
          >
            Last
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
            <tr>
              <th className="px-4 py-3">Block</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Txns</th>
              <th className="px-4 py-3 hidden md:table-cell">Miner</th>
              <th className="px-4 py-3 hidden lg:table-cell">Size</th>
              <th className="px-4 py-3 text-right">Reward</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {blocks.map((block) => (
              <tr
                key={block.index}
                className="hover:bg-muted/50 transition-colors"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-blue-500 hidden sm:block" />
                    <a
                      href={`/block/${block.index}`}
                      className="text-blue-500 hover:underline font-medium"
                    >
                      #{block.index}
                    </a>
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                  {block.timestamp
                    ? formatDistanceToNow(new Date(block.timestamp)) + " ago"
                    : "Calculating..."}
                </td>
                <td className="px-4 py-4">{block.transactions?.length || 0}</td>
                <td className="px-4 py-4 hidden md:table-cell font-mono text-xs text-blue-500">
                  <a
                    href={`/address/${block.validator}`}
                    className="hover:underline"
                  >
                    {block.validator || "0x00...000"}
                  </a>
                </td>
                <td className="px-4 py-4 hidden lg:table-cell text-muted-foreground">
                  {((block.transactions?.length || 0) * 0.5).toFixed(2)} KB
                </td>
                <td className="px-4 py-4 text-right font-bold text-slate-900">
                  {formatLMR(block.reward || 0)} LMR
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t bg-muted/10 flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          Show:{" "}
          <select className="bg-transparent border-none focus:ring-0 cursor-pointer font-medium p-0">
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1 border rounded hover:bg-muted disabled:opacity-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="p-1 border rounded hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlocksList;
