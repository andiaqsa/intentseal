import { ExternalLink } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { BOT_CHAIN } from "../config/network";
import { BrandMark } from "./BrandMark";
import { WalletControl } from "./WalletControl";

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-3 py-2 text-xs font-medium transition ${
    isActive ? "bg-white/[0.07] text-white" : "text-zinc-500 hover:text-zinc-200"
  }`;
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#08090a] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#08090a]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandMark />
          <div className="flex items-center gap-1.5 sm:gap-4">
            <nav className="flex items-center" aria-label="Primary navigation">
              <NavLink to="/create" className={navClass}>Create</NavLink>
              <NavLink to="/evaluate" className={navClass}>Evidence</NavLink>
              <NavLink to="/verify" className={navClass}>Verify</NavLink>
            </nav>
            <div className="hidden h-5 w-px bg-white/10 sm:block" />
            <WalletControl />
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Secured by BOT Chain · Testnet</p>
          <div className="flex items-center gap-5">
            <a className="footer-link" href="https://botchain.ai" target="_blank" rel="noreferrer">
              BOT Chain <ExternalLink size={11} />
            </a>
            <a className="footer-link" href={BOT_CHAIN.explorerUrl} target="_blank" rel="noreferrer">
              Explorer <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
