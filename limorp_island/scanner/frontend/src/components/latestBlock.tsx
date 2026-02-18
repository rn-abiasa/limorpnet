import { Box, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatLMR } from "@/lib/utils";

const LatestBlocks = ({ blocks = [] }: { blocks: any[] }) => {
  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center bg-muted/30">
        <h2 className="font-semibold">Latest Blocks</h2>
        <a
          href="/blocks"
          className="text-xs font-medium text-blue-500 hover:underline"
        >
          View All
        </a>
      </div>
      <div className="divide-y">
        {blocks.length === 0 && (
          <p className="p-8 text-center text-muted-foreground italic text-sm">
            Waiting for blocks...
          </p>
        )}
        {blocks.map((block) => (
          <div
            key={block.index}
            className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <a
                  href={`/block/${block.index}`}
                  className="font-medium text-blue-500 hover:underline"
                >
                  #{block.index}
                </a>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(block.timestamp))} ago
                </p>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-xs font-medium max-w-[150px] truncate">
                Miner: {block.validator || "Genesis"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {block.transactions?.length || 0} txns
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold">
                  {block.reward ? formatLMR(block.reward, 2) : "0"} LMR{" "}
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Bonus
                  </span>
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

export default LatestBlocks;
