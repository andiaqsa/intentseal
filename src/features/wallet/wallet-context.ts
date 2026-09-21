import { createContext, useContext } from "react";

export type ConnectionState = "unavailable" | "disconnected" | "connecting" | "connected";

export interface WalletContextValue {
  account: string | null;
  chainId: string | null;
  connectionState: ConnectionState;
  error: string | null;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  clearError: () => void;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
