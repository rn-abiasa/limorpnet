import { Button } from "./ui/button";
import { Menu, Search } from "lucide-react";

const Navbar = () => {
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
          <Button variant="outline" className="hidden md:flex">
            Connect Wallet
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
