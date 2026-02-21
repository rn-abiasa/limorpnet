import { Link, useLocation, Outlet } from "react-router-dom";
import React from "react";
import {
  Droplets,
  ArrowLeftRight,
  PieChart,
  Rocket,
  Menu,
  X,
} from "lucide-react";
import { WalletDropdown } from "@/components/WalletDropdown";

const Navbar = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { name: "Swap", path: "/", icon: ArrowLeftRight },
    { name: "Tokens", path: "/tokens", icon: PieChart },
    { name: "Pools", path: "/liquidity", icon: Droplets },
    { name: "Launchpad", path: "/launchpad", icon: Rocket },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-black/50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <Droplets className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-black italic tracking-tighter text-white">
              LIMORP<span className="text-emerald-500">DEX</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800/50 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                    isActive
                      ? "bg-zinc-800 text-white shadow-lg"
                      : "text-zinc-500 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" />
              <span className="text-xs font-bold text-zinc-400">
                Limorp Mainnet
              </span>
            </div>
            <WalletDropdown />

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 text-zinc-400 hover:text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-zinc-900 border-b border-zinc-800 p-4 space-y-2 animate-in slide-in-from-top duration-300">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-3 rounded-xl text-lg font-bold text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

function App() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400">
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <Navbar />

      <main className="relative z-10 pt-4 pb-20">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-900 py-12 bg-zinc-950/50 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 opacity-50 grayscale">
            <Droplets className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-xl tracking-tighter">
              LIMORPDEX
            </span>
          </div>
          <div className="flex gap-8 text-sm text-zinc-500 font-medium">
            <a href="#" className="hover:text-white transition-colors">
              Documentation
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Github
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Twitter
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Telegram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
