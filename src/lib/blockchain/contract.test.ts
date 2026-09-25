import { Interface, ZeroHash } from "ethers";
import { describe, expect, it } from "vitest";

import { INTENTSEAL_CONTRACT_ADDRESS } from "../../config/network";
import { INTENTSEAL_ABI } from "./abi";
import { parseIntentSealed, parseOnChainIntentResult, parseOutcomeSealed } from "./contract";

const CREATOR = "0x1111111111111111111111111111111111111111";
const INTENT_HASH = `0x${"3".repeat(64)}`;
const OUTCOME_HASH = `0x${"4".repeat(64)}`;

describe("IntentSeal contract result boundaries", () => {
  it("parses the intent ID and values from an actual ABI-encoded IntentSealed log", () => {
    const contractInterface = new Interface(INTENTSEAL_ABI);
    const encoded = contractInterface.encodeEventLog(contractInterface.getEvent("IntentSealed")!, [
      5n,
      CREATOR,
      INTENT_HASH,
      1_740_000_000n,
    ]);

    const parsed = parseIntentSealed({
      logs: [{ address: INTENTSEAL_CONTRACT_ADDRESS, topics: encoded.topics, data: encoded.data }],
    } as never);
    expect(parsed).toEqual({
      intentId: 5n,
      creator: CREATOR,
      intentHash: INTENT_HASH,
      timestamp: 1_740_000_000n,
    });
  });

  it("rejects a receipt without a valid IntentSealed log", () => {
    expect(() => parseIntentSealed({ logs: [] } as never)).toThrow("INTENT_EVENT_NOT_FOUND");
  });

  it("parses OutcomeSealed and rejects a receipt without that event", () => {
    const contractInterface = new Interface(INTENTSEAL_ABI);
    const encoded = contractInterface.encodeEventLog(contractInterface.getEvent("OutcomeSealed")!, [
      5n,
      OUTCOME_HASH,
      1_740_003_600n,
    ]);
    expect(parseOutcomeSealed({
      logs: [{ address: INTENTSEAL_CONTRACT_ADDRESS, topics: encoded.topics, data: encoded.data }],
    } as never)).toEqual({ intentId: 5n, outcomeHash: OUTCOME_HASH, timestamp: 1_740_003_600n });
    expect(() => parseOutcomeSealed({ logs: [] } as never)).toThrow("OUTCOME_EVENT_NOT_FOUND");
  });

  it("accepts a complete valid getIntent result and rejects malformed results", () => {
    const valid = {
      creator: CREATOR,
      intentHash: INTENT_HASH,
      outcomeHash: ZeroHash,
      createdAt: 1n,
      completedAt: 0n,
      completed: false,
    };
    expect(parseOnChainIntentResult(valid)).toEqual(valid);
    expect(() => parseOnChainIntentResult({ creator: CREATOR })).toThrow(
      "INVALID_CONTRACT_RESULT",
    );
    expect(() => parseOnChainIntentResult(null)).toThrow("INVALID_CONTRACT_RESULT");
  });
});
