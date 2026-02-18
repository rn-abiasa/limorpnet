import { Box, Zap, Coins, Globe } from "lucide-react";
import { formatLMR } from "@/lib/utils";

const StatCard = ({ icon: Icon, label, value, subtext }: any) => (
  <div className="flex items-start gap-4 p-4 bg-card border rounded-xl shadow-sm hover:translate-y-[-2px] transition-all duration-200">
    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
      {subtext && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>
      )}
    </div>
  </div>
);

const Statistic = ({ stats }: { stats: any }) => {
  return (
    <div className="container mx-auto px-4 -mt-8 relative z-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Box}
          label="Latest Block"
          value={stats?.height ? stats.height.toLocaleString() : "..."}
          subtext={stats?.isSyncing ? "Syncing..." : "Height"}
        />
        <StatCard
          icon={Zap}
          label="Mempool"
          value={stats?.mempool ?? "0"}
          subtext="Pending txs"
        />
        <StatCard
          icon={Coins}
          label="Total Supply"
          value={
            stats?.totalSupply ? `${formatLMR(stats.totalSupply)} LMR` : "..."
          }
          subtext="LMR Tokens"
        />
        <StatCard
          icon={Globe}
          label="Active Peers"
          value={stats?.peers ?? "0"}
          subtext="P2P Connections"
        />
      </div>
    </div>
  );
};

export default Statistic;
