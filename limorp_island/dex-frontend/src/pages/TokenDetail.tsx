import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { ExternalLink, Copy, Share2, ArrowLeft } from "lucide-react";
import { useLimorpRPC } from "@/hooks/useLimorpRPC";

const WLMR = "0x91b0625cb583e6555c7eeb97f92dc0c9c6d82e7d";
const LUSD = "0x81aaaa8113a6d35975144b5cbba81f3324bfa125";
const FACTORY = "0x3321937306b612ca386007780f18c1b1bbecf664";

const TokenDetail = () => {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const rpc = useLimorpRPC();
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const address =
        symbol === "WLMR" ? WLMR : symbol === "LUSD" ? LUSD : "native";
      const name =
        symbol === "LMR"
          ? "Limorp"
          : symbol === "WLMR"
            ? "Wrapped LMR"
            : "USD Limorp";

      // Fetch Price
      const pair = await rpc.readContract(FACTORY, "getPair", [WLMR, LUSD]);
      let price = 1.0;
      if (pair && pair !== "0x0000000000000000000000000000000000000000") {
        const res = await rpc.readContract(pair, "getReserves");
        if (res && BigInt(res[0]) > 0n) {
          price = Number(res[1]) / Number(res[0]);
        }
      }

      // Fetch Supply
      let supply = 0n;
      if (address !== "native") {
        supply = await rpc.readContract(address, "totalSupply");
      } else {
        // For native LMR, we can use a fixed value or fetch from node (total minted)
        supply = 1500000000n * 10n ** 18n; // Placeholder for native
      }

      const currentPrice = symbol === "LUSD" ? 1.0 : price;

      setTokenInfo({
        name,
        symbol,
        address: address === "native" ? "Native Asset" : address,
        price: currentPrice.toFixed(4),
        supply: (Number(supply) / 1e18).toLocaleString(),
        mcap: ((Number(supply) / 1e18) * currentPrice).toLocaleString(
          undefined,
          { maximumFractionDigits: 0 },
        ),
      });

      // Mock some chart data based on current price
      setChartData([
        { time: "00:00", price: currentPrice * 0.98 },
        { time: "08:00", price: currentPrice * 1.02 },
        { time: "16:00", price: currentPrice * 0.99 },
        { time: "23:59", price: currentPrice },
      ]);
    } catch (e) {
      console.error("Failed to fetch token detail:", e);
    }
  }, [symbol, rpc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!tokenInfo) return <div className="p-8 text-zinc-500">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <Button
        variant="ghost"
        onClick={() => navigate("/tokens")}
        className="text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tokens
      </Button>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-full ${symbol === "WLMR" ? "bg-emerald-600" : "bg-blue-600"} shadow-xl shadow-blue-500/20`}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-white">
                {tokenInfo.name}
              </h1>
              <Badge
                variant="outline"
                className="border-zinc-700 text-zinc-400"
              >
                {symbol === "LMR" ? "Native" : "LMR-20"}
              </Badge>
            </div>
            <div className="text-zinc-500 text-sm flex items-center gap-2">
              {tokenInfo.address}
              <Copy className="w-3 h-3 cursor-pointer hover:text-white transition-colors" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              ${tokenInfo.price}
            </div>
            <div className="text-emerald-400 font-medium">+0.0%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <Card className="lg:col-span-2 bg-zinc-900/50 border-zinc-800 backdrop-blur-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/50 mb-6">
            <div className="flex gap-2">
              {["1H", "1D", "1W", "1M"].map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  size="sm"
                  className={`rounded-lg px-3 ${t === "1D" ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
                >
                  {t}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-[400px] w-full p-0 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#27272a"
                />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 12 }}
                  dy={10}
                />
                <YAxis hide domain={["dataMin - 0.01", "dataMax + 0.01"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "12px",
                  }}
                  itemStyle={{ color: "#10b981" }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Info Column */}
        <div className="space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white font-bold">
                Token Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500">Market Cap</span>
                <span className="text-white font-medium">
                  ${tokenInfo.mcap}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500">Circulating Supply</span>
                <span className="text-white font-medium">
                  {tokenInfo.supply} {symbol}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500">Network</span>
                <span className="text-white font-medium">Limorp Mainnet</span>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={() => navigate("/swap")}
            className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 text-lg font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            Trade {symbol}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TokenDetail;
