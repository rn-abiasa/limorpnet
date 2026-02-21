import { useState } from "react";
import { Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTokens, type Token } from "@/hooks/useTokens";
import { useWallet } from "@/context/WalletContext";

interface TokenSelectorProps {
  selectedAddress?: string;
  onSelect: (token: Token) => void;
  exclude?: string[];
}

export const TokenSelector = ({
  selectedAddress,
  onSelect,
  exclude = [],
}: TokenSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { tokens } = useTokens();
  const { assets } = useWallet();

  const filteredTokens = tokens.filter(
    (t) =>
      !exclude.includes(t.address) &&
      (t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.address.toLowerCase() === search.toLowerCase()),
  );

  const getBalance = (address: string) => {
    const asset = assets.find((a) => a.address === address);
    return asset ? asset.balance : "0";
  };

  const handleSelect = (token: Token) => {
    onSelect(token);
    setIsOpen(false);
    setSearch("");
  };

  const selectedToken = tokens.find((t) => t.address === selectedAddress);

  return (
    <div className="relative w-full">
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="w-full h-14 justify-between bg-zinc-900 border-zinc-800 rounded-2xl px-4 hover:bg-zinc-800 transition-all group"
      >
        <div className="flex items-center gap-3">
          {selectedToken ? (
            <>
              <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                {selectedToken.symbol[0]}
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">
                  {selectedToken.symbol}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {selectedToken.name}
                </div>
              </div>
            </>
          ) : (
            <span className="text-zinc-500 font-bold">Select a token</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedToken && (
            <span className="text-xs text-zinc-500 font-medium mr-2">
              Balance: {getBalance(selectedToken.address)}
            </span>
          )}
          <ChevronDown className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        </div>
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Select a token</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Search by name or paste address"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-12 bg-zinc-900 border-zinc-800 rounded-xl focus:ring-emerald-500/50"
                  autoFocus
                />
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {filteredTokens.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 font-medium">
                    No tokens found.
                  </div>
                ) : (
                  filteredTokens.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handleSelect(token)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                        selectedAddress === token.address
                          ? "bg-blue-600/10 border border-blue-600/20"
                          : "hover:bg-zinc-900 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-blue-400 shadow-inner">
                          {token.symbol[0]}
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-white flex items-center gap-2">
                            {token.symbol}
                            {selectedAddress === token.address && (
                              <Check className="w-3 h-3 text-emerald-500" />
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 uppercase tracking-tighter">
                            {token.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-zinc-300">
                          {getBalance(token.address)}
                        </div>
                        <div className="text-[10px] text-zinc-600 font-bold uppercase">
                          Balance
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ChevronDown = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
