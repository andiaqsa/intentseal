import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { isBotChain } from "../../config/network";
import { logDevelopmentError, toUserError } from "../../lib/errors";
import {
  getBrowserProvider,
  getInjectedChainId,
  switchToBotChain,
} from "../../lib/blockchain/provider";
import { type ConnectionState, WalletContext } from "./wallet-context";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    window.ethereum?.isMetaMask ? "disconnected" : "unavailable",
  );
  const [error, setError] = useState<string | null>(null);

  const syncWallet = useCallback(async () => {
    if (!window.ethereum?.isMetaMask) return;
    try {
      const provider = getBrowserProvider();
      const accounts = (await provider.send("eth_accounts", [])) as string[];
      const currentChain = await getInjectedChainId();
      setAccount(accounts[0] ?? null);
      setChainId(currentChain);
      setConnectionState(accounts[0] ? "connected" : "disconnected");
    } catch (syncError) {
      logDevelopmentError("Wallet sync failed", syncError);
      setConnectionState("disconnected");
    }
  }, []);

  useEffect(() => {
    const initialSync = window.setTimeout(() => void syncWallet(), 0);
    const ethereum = window.ethereum;
    if (!ethereum?.isMetaMask || !ethereum.on) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      setAccount(accounts[0] ?? null);
      setConnectionState(accounts[0] ? "connected" : "disconnected");
      setError(null);
    };
    const handleChainChanged = (...args: unknown[]) => {
      setChainId(typeof args[0] === "string" ? args[0] : null);
      setError(null);
    };
    const handleDisconnect = () => {
      setAccount(null);
      setConnectionState("disconnected");
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    ethereum.on("disconnect", handleDisconnect);

    return () => {
      window.clearTimeout(initialSync);
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
      ethereum.removeListener?.("disconnect", handleDisconnect);
    };
  }, [syncWallet]);

  const connect = useCallback(async () => {
    setError(null);
    setConnectionState("connecting");
    try {
      const provider = getBrowserProvider();
      const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
      const currentChain = await getInjectedChainId();
      setAccount(accounts[0] ?? null);
      setChainId(currentChain);
      setConnectionState(accounts[0] ? "connected" : "disconnected");
    } catch (connectError) {
      logDevelopmentError("Wallet connection failed", connectError);
      setConnectionState(window.ethereum?.isMetaMask ? "disconnected" : "unavailable");
      setError(toUserError(connectError, "wallet"));
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    setError(null);
    try {
      await switchToBotChain();
      setChainId(await getInjectedChainId());
    } catch (switchError) {
      logDevelopmentError("Network switch failed", switchError);
      setError(toUserError(switchError, "network"));
    }
  }, []);

  const value = useMemo(
    () => ({
      account,
      chainId,
      connectionState,
      error,
      isCorrectNetwork: isBotChain(chainId),
      connect,
      switchNetwork,
      clearError: () => setError(null),
    }),
    [account, chainId, connect, connectionState, error, switchNetwork],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
