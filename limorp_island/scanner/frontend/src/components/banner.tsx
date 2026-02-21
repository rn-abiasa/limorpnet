import { Search } from "lucide-react";

const Banner = () => {
  return (
    <div
      className="relative overflow-hidden bg-slate-950 py-16 sm:py-24"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 40%), radial-gradient(circle at bottom left, rgba(79, 70, 229, 0.1), transparent 40%)",
      }}
    >
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-4">
            Limorp Blockchain Explorer
          </h1>
          <p className="text-lg text-slate-400 mb-8">
            Explore and track transactions, blocks, and addresses on the Limorp
            network.
          </p>

          <div className="flex w-full max-w-xl items-center space-x-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search by Address / Txn Hash / Block / Token"
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-2xl"
              />
            </div>
            <button className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
              Search
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Featured:</span>
            <a href="#" className="text-blue-400 hover:underline">
              Latest Block #12,431
            </a>
            <span>•</span>
            <a href="#" className="text-blue-400 hover:underline">
              Price: $0.42
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Banner;
