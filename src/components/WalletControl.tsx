import { AlertCircle, Check, ChevronDown, CircleDot, Wallet } from "lucide-react";
import { useState } from "react";

import { BOT_CHAIN } from "../config/network";
import { useWallet } from "../features/wallet/wallet-context";
import { shortenAddress } from "../lib/format";

export function WalletControl() {
  const [open, setOpen] = useState(false);
  const {
    account,
    connectionState,
    error,
    isCorrectNetwork,
    connect,
    switchNetwork,
    clearError,
  } = useWallet();

  if (!account) {
    return (
      <div className="relative">
        <button
          type="button"
          className="button button-primary h-9 px-3.5 text-xs"
          onClick={() => void connect()}
          disabled={connectionState === "connecting"}
        >
          <Wallet size={14} />
          {connectionState === "connecting" ? "Connecting…" : "Connect wallet"}
        </button>
        {error && (
          <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-red-400/20 bg-[#17100f] p-3 text-xs leading-5 text-red-100 shadow-2xl">
            <button className="float-right text-red-200/60 hover:text-red-100" onClick={clearError}>
              ×
            </button>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-xs text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.07]"
        aria-expanded={open}
      >
        <span className={`size-1.5 rounded-full ${isCorrectNetwork ? "bg-emerald-400" : "bg-amber-400"}`} />
        <span className="font-mono">{shortenAddress(account)}</span>
        <ChevronDown size={13} className="text-zinc-500" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-white/10 bg-[#111315] p-2 shadow-2xl shadow-black/60">
          <div className="px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600">Connected wallet</p>
            <p className="mt-1.5 truncate font-mono text-xs text-zinc-300">{account}</p>
          </div>
          <div className="my-1 h-px bg-white/[0.07]" />
          <div className="flex items-center gap-2 px-2.5 py-2 text-xs">
            {isCorrectNetwork ? (
              <Check size={14} className="text-emerald-400" />
            ) : (
              <AlertCircle size={14} className="text-amber-400" />
            )}
            <span className="text-zinc-300">
              {isCorrectNetwork ? BOT_CHAIN.chainName : "Wrong network"}
            </span>
          </div>
          {!isCorrectNetwork && (
            <button
              type="button"
              className="button button-primary mt-1 w-full text-xs"
              onClick={() => void switchNetwork()}
            >
              <CircleDot size={14} /> Switch to BOT Chain
            </button>
          )}
          {error && <p className="px-2.5 py-2 text-xs leading-5 text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
