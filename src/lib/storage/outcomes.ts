import type { EvidenceAnalysisResult } from "../../../shared/evidence";
import { BOT_CHAIN, INTENTSEAL_CONTRACT_ADDRESS } from "../../config/network";

export interface StoredOutcomeAnalysis extends EvidenceAnalysisResult {
  intentId: string;
  repository: string;
  commit: string;
  seal?: {
    outcomeHash: string;
    transactionHash: string;
    completedAt: number;
  };
}

export function outcomeStorageKey(intentId: string, commit: string): string {
  return `intentseal:outcome:${BOT_CHAIN.chainId}:${INTENTSEAL_CONTRACT_ADDRESS.toLowerCase()}:${intentId}:${commit.toLowerCase()}`;
}

export function storeOutcomeAnalysis(record: StoredOutcomeAnalysis): void {
  localStorage.setItem(outcomeStorageKey(record.intentId, record.commit), JSON.stringify(record));
}

export function getStoredOutcomeAnalysis(intentId: string, commit: string): StoredOutcomeAnalysis | null {
  const value = localStorage.getItem(outcomeStorageKey(intentId, commit));
  if (!value) return null;
  try {
    return JSON.parse(value) as StoredOutcomeAnalysis;
  } catch {
    return null;
  }
}

export function getStoredOutcomeForIntent(intentId: string): StoredOutcomeAnalysis | null {
  const prefix = `intentseal:outcome:${BOT_CHAIN.chainId}:${INTENTSEAL_CONTRACT_ADDRESS.toLowerCase()}:${intentId}:`;
  const matches: StoredOutcomeAnalysis[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as StoredOutcomeAnalysis | null;
      if (parsed) matches.push(parsed);
    } catch {
      // Ignore malformed browser records.
    }
  }
  return matches.sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))[0] ?? null;
}
