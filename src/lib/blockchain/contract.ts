import { Contract, Interface, type ContractRunner, type TransactionReceipt } from "ethers";

import { INTENTSEAL_CONTRACT_ADDRESS } from "../../config/network";
import type { OnChainIntent } from "../../types/intent";
import { INTENTSEAL_ABI } from "./abi";
import { getReadProvider } from "./provider";

const intentSealInterface = new Interface(INTENTSEAL_ABI);

export interface IntentSealedEvent {
  intentId: bigint;
  creator: string;
  intentHash: string;
  timestamp: bigint;
}

export interface OutcomeSealedEvent {
  intentId: bigint;
  outcomeHash: string;
  timestamp: bigint;
}

export function getIntentSealContract(runner: ContractRunner = getReadProvider()): Contract {
  return new Contract(INTENTSEAL_CONTRACT_ADDRESS, INTENTSEAL_ABI, runner);
}

export async function readIntent(
  intentId: bigint,
  runner: ContractRunner = getReadProvider(),
): Promise<OnChainIntent> {
  const result = await getIntentSealContract(runner).getIntent(intentId);
  return parseOnChainIntentResult(result);
}

export function parseOnChainIntentResult(result: unknown): OnChainIntent {
  if (typeof result !== "object" || result === null) throw new Error("INVALID_CONTRACT_RESULT");
  const value = result as Record<string, unknown>;
  if (
    typeof value.creator !== "string" ||
    typeof value.intentHash !== "string" ||
    typeof value.outcomeHash !== "string" ||
    typeof value.createdAt !== "bigint" ||
    typeof value.completedAt !== "bigint" ||
    typeof value.completed !== "boolean"
  ) {
    throw new Error("INVALID_CONTRACT_RESULT");
  }

  return {
    creator: value.creator,
    intentHash: value.intentHash,
    outcomeHash: value.outcomeHash,
    createdAt: value.createdAt,
    completedAt: value.completedAt,
    completed: value.completed,
  };
}

export function parseIntentSealed(receipt: TransactionReceipt): IntentSealedEvent {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== INTENTSEAL_CONTRACT_ADDRESS.toLowerCase()) continue;

    try {
      const parsed = intentSealInterface.parseLog(log);
      if (parsed?.name === "IntentSealed") {
        return {
          intentId: parsed.args.intentId as bigint,
          creator: parsed.args.creator as string,
          intentHash: parsed.args.intentHash as string,
          timestamp: parsed.args.timestamp as bigint,
        };
      }
    } catch {
      // Receipts may contain unrelated logs. Only the matching event is relevant.
    }
  }

  throw new Error("INTENT_EVENT_NOT_FOUND");
}

export function parseOutcomeSealed(receipt: TransactionReceipt): OutcomeSealedEvent {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== INTENTSEAL_CONTRACT_ADDRESS.toLowerCase()) continue;
    try {
      const parsed = intentSealInterface.parseLog(log);
      if (parsed?.name === "OutcomeSealed") {
        return {
          intentId: parsed.args.intentId as bigint,
          outcomeHash: parsed.args.outcomeHash as string,
          timestamp: parsed.args.timestamp as bigint,
        };
      }
    } catch {
      // Ignore unrelated or malformed receipt logs.
    }
  }
  throw new Error("OUTCOME_EVENT_NOT_FOUND");
}
