export interface IntentInput {
  title: string;
  goal: string;
  criteria: string[];
}

export interface CanonicalIntent {
  schema: "intentseal.intent.v1";
  title: string;
  goal: string;
  criteria: string[];
}

export interface OnChainIntent {
  creator: string;
  intentHash: string;
  outcomeHash: string;
  createdAt: bigint;
  completedAt: bigint;
  completed: boolean;
}

export interface SealedIntentRecord {
  intentId: string;
  creator: string;
  canonicalPayload: string;
  intentHash: string;
  transactionHash: string;
  createdAt: number;
}

export type TransactionState =
  | "idle"
  | "preparing"
  | "awaiting_wallet"
  | "submitted"
  | "confirming"
  | "success"
  | "error";
