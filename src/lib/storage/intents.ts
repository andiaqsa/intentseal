import { BOT_CHAIN, INTENTSEAL_CONTRACT_ADDRESS } from "../../config/network";
import type { SealedIntentRecord } from "../../types/intent";

export function intentStorageKey(intentId: string): string {
  return `intentseal:${BOT_CHAIN.chainId}:${INTENTSEAL_CONTRACT_ADDRESS.toLowerCase()}:${intentId}`;
}

export function storeSealedIntent(record: SealedIntentRecord): void {
  localStorage.setItem(intentStorageKey(record.intentId), JSON.stringify(record));
}

export function getStoredIntent(intentId: string): SealedIntentRecord | null {
  const value = localStorage.getItem(intentStorageKey(intentId));
  if (!value) return null;

  try {
    return JSON.parse(value) as SealedIntentRecord;
  } catch {
    return null;
  }
}
