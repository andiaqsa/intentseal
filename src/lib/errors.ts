interface CodedError {
  code?: number | string;
  message?: string;
  shortMessage?: string;
  reason?: string;
  data?: unknown;
  error?: unknown;
}

function errorDetails(error: unknown): CodedError {
  if (typeof error !== "object" || error === null) return {};
  return error as CodedError;
}

export function toUserError(error: unknown, context: "wallet" | "network" | "transaction" | "read"): string {
  const details = errorDetails(error);
  const nested = errorDetails(details.error ?? details.data);
  const code = details.code ?? nested.code;
  const message = [details.shortMessage, details.reason, details.message, nested.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (error instanceof Error && error.message === "METAMASK_UNAVAILABLE") {
    return "MetaMask is not installed. Install the extension to connect a wallet.";
  }
  if (error instanceof Error && error.message === "INTENT_EVENT_NOT_FOUND") {
    return "The transaction confirmed, but its IntentSealed event could not be verified.";
  }
  if (error instanceof Error && error.message === "OUTCOME_EVENT_NOT_FOUND") {
    return "The transaction confirmed, but its OutcomeSealed event could not be verified.";
  }
  if (code === 4001 || code === "ACTION_REJECTED" || message.includes("user rejected")) {
    return context === "network"
      ? "The network switch was cancelled in MetaMask."
      : context === "wallet"
        ? "The wallet connection was cancelled."
        : "The transaction was cancelled in MetaMask.";
  }
  if (message.includes("insufficient funds")) {
    return "This wallet does not have enough BOT to pay the network fee.";
  }
  if (message.includes("notintentcreator")) {
    return "Only the wallet that created this intent can seal its outcome.";
  }
  if (message.includes("intentalreadycompleted")) {
    return "This intent already has a sealed outcome.";
  }
  if (message.includes("intentnotfound") || message.includes("missing revert data")) {
    return context === "read"
      ? "No intent exists with that ID on BOT Chain Testnet."
      : "The contract rejected this transaction.";
  }
  if (message.includes("network") || message.includes("failed to fetch") || message.includes("rpc")) {
    return "BOT Chain could not be reached. Check your connection and try again.";
  }
  if (context === "read") return "The intent could not be read from BOT Chain.";
  if (context === "network") return "MetaMask could not switch to BOT Chain Testnet.";
  if (context === "wallet") return "MetaMask could not connect this wallet.";
  return "The transaction could not be completed. No intent was saved locally.";
}

export function logDevelopmentError(label: string, error: unknown): void {
  if (import.meta.env.DEV) console.error(`[IntentSeal] ${label}`, error);
}
