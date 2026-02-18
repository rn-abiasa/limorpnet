import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  Box,
  Clock,
  Hash,
  User,
  Database,
  AlertCircle,
  FileText,
} from "lucide-react";
import Navbar from "@/components/navbar";
import { socket } from "@/lib/socket";
import { formatLMR } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const BlockDetail = () => {
  const { height } = useParams();
  const [block, setBlock] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    socket.emit("get-block", height);

    const handleBlockDetails = (data: any) => {
      setBlock(data);
      setLoading(false);
    };

    socket.once("block-details", handleBlockDetails);

    // Safety timeout to clear loading if no response
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("Block fetch timed out");
          return false;
        }
        return prev;
      });
    }, 5000);

    return () => {
      socket.off("block-details", handleBlockDetails);
      clearTimeout(timeout);
    };
  }, [height]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 bg-blue-500/20 rounded-full mb-4"></div>
            <p className="text-muted-foreground">
              Loading block information...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!block) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold">Block Not Found</h2>
          <p className="text-muted-foreground mt-2">
            The block you are looking for does not exist or hasn't been mined
            yet.
          </p>
          <Link
            to="/blocks"
            className="inline-block mt-6 text-blue-500 hover:underline"
          >
            Back to Blocks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            to="/blocks"
            className="flex items-center gap-1 text-sm text-blue-500 hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Blocks
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500 text-white">
              <Box className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Block #{block.index}
            </h1>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Overview Card */}
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h2 className="font-semibold text-lg">Overview</h2>
            </div>
            <div className="divide-y">
              <div className="grid grid-cols-1 md:grid-cols-3 p-4 items-center">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Hash className="w-4 h-4" /> Block Height
                </span>
                <span className="md:col-span-2 font-mono text-sm">
                  {block.index}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 p-4 items-center">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Timestamp
                </span>
                <span className="md:col-span-2 text-sm">
                  {new Date(block.timestamp).toLocaleString()} (
                  {formatDistanceToNow(new Date(block.timestamp))} ago)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 p-4 items-center">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Transactions
                </span>
                <span className="md:col-span-2 text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full inline-block w-fit">
                  {block.transactions?.length || 0} transactions
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 p-4 items-center">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="w-4 h-4" /> Validator / Miner
                </span>
                <span className="md:col-span-2 text-sm text-blue-500 font-mono break-all">
                  <Link
                    to={`/address/${block.validator}`}
                    className="hover:underline"
                  >
                    {block.validator}
                  </Link>
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 p-4 items-center">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Database className="w-4 h-4" /> Reward
                </span>
                <span className="md:col-span-2 font-bold text-slate-900">
                  {formatLMR(block.reward)} LMR
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 p-4 items-center">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Hash className="w-4 h-4" /> Block Hash
                </span>
                <span className="md:col-span-2 font-mono text-xs text-muted-foreground break-all">
                  {block.hash}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 p-4 items-center">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Hash className="w-4 h-4" /> Previous Hash
                </span>
                <span className="md:col-span-2 font-mono text-xs text-muted-foreground break-all">
                  {block.previousHash}
                </span>
              </div>
            </div>
          </div>

          {/* Transactions Card */}
          {block.transactions && block.transactions.length > 0 && (
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h2 className="font-semibold text-lg">
                  Transactions in this Block
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="px-4 py-3">Tx Hash</th>
                      <th className="px-4 py-3">From</th>
                      <th className="px-4 py-3">To</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {block.transactions.map((tx: any, idx: number) => (
                      <tr key={tx.hash || idx} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-blue-500 max-w-[150px] truncate">
                          <Link
                            to={`/tx/${tx.hash}`}
                            className="hover:underline"
                          >
                            {tx.hash}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-blue-500 max-w-[150px] truncate">
                          <Link
                            to={`/address/${tx.from}`}
                            className="hover:underline"
                          >
                            {tx.from}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-blue-500 max-w-[150px] truncate">
                          <Link
                            to={`/address/${tx.to}`}
                            className="hover:underline"
                          >
                            {tx.to}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {formatLMR(tx.amount)} LMR
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t bg-white py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © 2026 Limorp Scanner. Block Explorer Detail View.
        </div>
      </footer>
    </div>
  );
};

export default BlockDetail;
