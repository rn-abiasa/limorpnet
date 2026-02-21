import { Box, Zap, Coins, TrendingUp } from "lucide-react";
import { formatLMR } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

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

const TrendCard = ({ data }: { data: any[] }) => (
  <div className="flex flex-col p-4 bg-card border rounded-xl shadow-sm hover:translate-y-[-2px] transition-all duration-200 min-h-[100px]">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
          <TrendingUp className="w-4 h-4" />
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          TX Trend
        </p>
      </div>
      <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
        Live
      </p>
    </div>

    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorTxs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-xl border border-slate-700">
                    {payload[0].value} txs
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="txs"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTxs)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <p className="text-[10px] text-muted-foreground mt-1">Activity per block</p>
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
        <TrendCard data={stats?.txTrend || []} />
      </div>
    </div>
  );
};

export default Statistic;
