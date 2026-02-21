import { useEffect, useState } from "react";
import Navbar from "@/components/navbar";
import Banner from "@/components/banner";
import Statistic from "@/components/statistic";
import LatestBlocks from "@/components/latestBlock";
import LatestTransactions from "@/components/latestTransactions";
import { socket } from "@/lib/socket";

const Home = () => {
  const [data, setData] = useState<any>({
    stats: null,
    latestBlocks: [],
    latestTransactions: [],
  });

  useEffect(() => {
    socket.on("dashboard-update", (payload: any) => {
      setData(payload);
    });

    return () => {
      socket.off("dashboard-update");
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar />
      <main className="pb-20">
        <Banner />
        <Statistic stats={data.stats} />

        <div className="container mx-auto px-4 mt-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <LatestBlocks blocks={data.latestBlocks} />
            <LatestTransactions transactions={data.latestTransactions} />
          </div>
        </div>
      </main>

      <footer className="border-t bg-white py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="font-bold text-lg">
            Limorp <span className="text-blue-500">Scanner</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time On-chain Activity
          </p>
          <div className="text-xs text-muted-foreground mt-4">
            © 2026 Limorp Foundation.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
