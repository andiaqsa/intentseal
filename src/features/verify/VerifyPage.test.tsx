import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZeroHash } from "ethers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatTimestamp } from "../../lib/format";
import { intentStorageKey } from "../../lib/storage/intents";
import type { OnChainIntent } from "../../types/intent";
import { VerifyPage } from "./VerifyPage";

const blockchain = vi.hoisted(() => ({ readIntent: vi.fn() }));

vi.mock("../../lib/blockchain/contract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/blockchain/contract")>();
  return { ...actual, readIntent: blockchain.readIntent };
});

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const INTENT_HASH = `0x${"3".repeat(64)}`;
const OUTCOME_HASH = `0x${"4".repeat(64)}`;
const CREATED_AT = 1_740_000_000n;
const COMPLETED_AT = 1_740_003_600n;

function openIntent(): OnChainIntent {
  return {
    creator: ACCOUNT,
    intentHash: INTENT_HASH,
    outcomeHash: ZeroHash,
    createdAt: CREATED_AT,
    completedAt: 0n,
    completed: false,
  };
}

async function lookup(value: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Intent ID"), value);
  await user.click(screen.getByRole("button", { name: "Verify" }));
}

describe("Verify page", () => {
  beforeEach(() => {
    blockchain.readIntent.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("renders creator, intent hash, timestamp, and OPEN status", async () => {
    blockchain.readIntent.mockResolvedValue(openIntent());
    render(<VerifyPage />);
    await lookup("5");

    expect(await screen.findByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText(ACCOUNT)).toBeInTheDocument();
    expect(screen.getByText(INTENT_HASH)).toBeInTheDocument();
    expect(screen.getByText(formatTimestamp(CREATED_AT))).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.getByText("Not completed")).toBeInTheDocument();
    expect(blockchain.readIntent).toHaveBeenCalledWith(5n);
  });

  it("renders a completed outcome hash and completion timestamp", async () => {
    blockchain.readIntent.mockResolvedValue({
      ...openIntent(),
      outcomeHash: OUTCOME_HASH,
      completedAt: COMPLETED_AT,
      completed: true,
    });
    render(<VerifyPage />);
    await lookup("5");

    expect(await screen.findByText("COMPLETED")).toBeInTheDocument();
    expect(screen.getByText(OUTCOME_HASH)).toBeInTheDocument();
    expect(screen.getByText(formatTimestamp(COMPLETED_AT))).toBeInTheDocument();
  });

  it.each(["", "0", "-1", "abc", "1.5"])("rejects invalid ID %j without making an RPC read", async (value) => {
    render(<VerifyPage />);
    if (value) await lookup(value);
    else await userEvent.setup().click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText("Enter a valid intent ID greater than zero.")).toBeInTheDocument();
    expect(blockchain.readIntent).not.toHaveBeenCalled();
  });

  it("shows a clear nonexistent-intent error", async () => {
    blockchain.readIntent.mockRejectedValue(new Error("execution reverted: IntentNotFound()"));
    render(<VerifyPage />);
    await lookup("999");
    expect(await screen.findByText("No intent exists with that ID on BOT Chain Testnet.")).toBeInTheDocument();
  });

  it("shows a clear RPC error without crashing", async () => {
    blockchain.readIntent.mockRejectedValue(new Error("failed to fetch RPC response"));
    render(<VerifyPage />);
    await lookup("5");
    expect(await screen.findByText("BOT Chain could not be reached. Check your connection and try again.")).toBeInTheDocument();
  });

  it("labels restored browser data as local application data", async () => {
    blockchain.readIntent.mockResolvedValue(openIntent());
    localStorage.setItem(
      intentStorageKey("5"),
      JSON.stringify({
        intentId: "5",
        creator: ACCOUNT,
        canonicalPayload: '{"schema":"intentseal.intent.v1"}',
        intentHash: INTENT_HASH,
        transactionHash: `0x${"a".repeat(64)}`,
        createdAt: Number(CREATED_AT),
      }),
    );
    render(<VerifyPage />);
    await lookup("5");

    expect(await screen.findByText("Local intent available")).toBeInTheDocument();
    expect(screen.getByText(/local application data in this browser/i)).toBeInTheDocument();
    expect(screen.queryByText(/stored on blockchain/i)).not.toBeInTheDocument();
    expect(screen.getByText('{"schema":"intentseal.intent.v1"}')).toBeInTheDocument();
  });
});
