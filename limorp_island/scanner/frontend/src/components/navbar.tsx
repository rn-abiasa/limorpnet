import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Menu, Search, Wallet } from "lucide-react";

const Navbar = () => {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      if ((window as any).limorp) {
        try {
          const res = await (window as any).limorp.request({
            type: "GET_STATUS",
          });
          if (res.unlocked && res.address) {
            setAddress(res.address);
          }
        } catch (e) {
          console.debug("Extension not ready or not found");
        }
      }
    };
    checkConnection();
  }, []);

  const handleConnect = async () => {
    if ((window as any).limorp) {
      try {
        const res = await (window as any).limorp.request({
          type: "GET_STATUS",
        });
        if (res.unlocked && res.address) {
          setAddress(res.address);
        } else if (!res.initialized) {
          alert("Please initialize your Limorp Wallet extension first.");
        } else {
          alert("Please unlock your Limorp Wallet extension.");
        }
      } catch (e) {
        console.error("Connection failed", e);
      }
    } else {
      window.open("https://github.com/limorp/wallet-extension", "_blank");
      alert("Limorp Wallet extension not found. Please install it!");
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/98 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <a href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight text-primary">
              Limorp <span className="text-blue-500">Scanner</span>
            </span>
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="/" className="transition-colors hover:text-primary">
              Dashboard
            </a>
            <a
              href="/blocks"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              Blocks
            </a>
            <a
              href="/txs"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              Transactions
            </a>
            <a
              href="/tokens"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              Tokens
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by Address / Txn Hash / Block..."
              className="pl-8 h-9 w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>

          {address ? (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100 text-sm font-medium">
              <Wallet className="w-4 h-4" />
              {truncateAddress(address)}
            </div>
          ) : (
            <Button
              variant="outline"
              className="hidden md:flex"
              onClick={handleConnect}
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
