import { useEffect, useState } from "react";
import Navbar from "@/components/navbar";
import BlocksList from "@/components/blocksList";
import { socket } from "@/lib/socket";
import { formatLMR } from "@/lib/utils";

const Blocks = () => {
  const [data, setData] = useState<any>({
    stats: null,
    latestBlocks: [],
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [paginatedBlocks, setPaginatedBlocks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    // Live updates for stats
    socket.on("dashboard-update", (payload: any) => {
      setData(payload);
      if (page === 1) {
        // If on first page, we can show live blocks or refresh paginated
        setTotal(payload.stats.height + 1);
      }
    });

    socket.on("pagination-blocks-res", (res: any) => {
      setPaginatedBlocks(res.blocks);
      setTotal(res.total);
    });

    // Initial fetch
    socket.emit("get-pagination-blocks", { page, limit });

    return () => {
      socket.off("dashboard-update");
      socket.off("pagination-blocks-res");
    };
  }, [page, limit]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    socket.emit("get-pagination-blocks", { page: newPage, limit });
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page
    socket.emit("get-pagination-blocks", { page: 1, limit: newLimit });
  };

  const isLive = page === 1 && limit === 25;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Blocks</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <a href="/" className="hover:text-primary transition-colors">
              Home
            </a>
            <span>/</span>
            <span className="text-foreground font-medium">Blocks</span>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="bg-blue-600 rounded-xl p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">
                  Network Summary
                </p>
                <h3 className="text-xl font-bold mt-1">
                  {data.stats?.height !== undefined
                    ? (data.stats.height + 1).toLocaleString()
                    : "..."}{" "}
                  Blocks
                </h3>
              </div>
              <div className="flex gap-4 sm:gap-8">
                <div>
                  <p className="text-blue-200 text-xs">Mempool Txs</p>
                  <p className="text-lg font-bold">
                    {data.stats?.mempool ?? "0"}
                  </p>
                </div>
                <div>
                  <p className="text-blue-200 text-xs">Total Supply</p>
                  <p className="text-lg font-bold truncate max-w-[150px]">
                    {data.stats?.totalSupply
                      ? `${formatLMR(data.stats.totalSupply)} LMR`
                      : "..."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <BlocksList
            blocks={
              paginatedBlocks.length > 0 ? paginatedBlocks : data.latestBlocks
            }
            page={page}
            limit={limit}
            total={total}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            isLive={isLive}
          />
        </div>
      </main>

      <footer className="border-t bg-white py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © 2026 Limorp Scanner. Real-time data.
        </div>
      </footer>
    </div>
  );
};

export default Blocks;
