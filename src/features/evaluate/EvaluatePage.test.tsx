import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZeroHash } from "ethers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { EvidenceAnalysisResult } from "../../../shared/evidence";
import { canonicalizeIntent, hashIntent } from "../../lib/canonical/intent";
import { hashOutcome } from "../../lib/canonical/outcome";
import { intentStorageKey } from "../../lib/storage/intents";
import { outcomeStorageKey } from "../../lib/storage/outcomes";
import type { OnChainIntent } from "../../types/intent";
import { BOT_CHAIN } from "../../config/network";
import { installMockProvider, MockEip1193Provider } from "../../test/mockEip1193Provider";
import { WalletProvider } from "../wallet/WalletContext";
import { EvaluatePage } from "./EvaluatePage";

const mocks = vi.hoisted(() => ({ readIntent: vi.fn(), analyzeEvidence: vi.fn(), getIntentSealContract: vi.fn(), parseOutcomeSealed: vi.fn() }));
vi.mock("../../lib/blockchain/contract", () => ({ readIntent: mocks.readIntent, getIntentSealContract: mocks.getIntentSealContract, parseOutcomeSealed: mocks.parseOutcomeSealed }));
vi.mock("../../lib/evidence/analyze", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/evidence/analyze")>();
  return { ...actual, analyzeEvidence: mocks.analyzeEvidence };
});

const canonical = {
  title: "Add login rate limiting",
  goal: "Implement login rate limiting.",
  criteria: ["Use a threshold.", "Return HTTP 429.", "Add automated tests."],
};
const hash = hashIntent(canonical);
const commit = "a".repeat(40);

const analysis: EvidenceAnalysisResult = {
  analyzedAt: "2026-01-02T03:04:05.000Z",
  evidenceFileCount: 3,
  outcomeDraft: {
    schema: "intentseal.outcome.v1",
    intentId: "5",
    source: {
      type: "github",
      repository: "demo/app",
      commit,
      commitUrl: `https://github.com/demo/app/commit/${commit}`,
    },
    evaluations: canonical.criteria.map((criterion, criterionIndex) => ({
      criterionIndex,
      criterion,
      status: (["SATISFIED", "PARTIAL", "NOT_FOUND"] as const)[criterionIndex]!,
      explanation: `Explanation ${criterionIndex}`,
      evidence: criterionIndex === 2 ? [] : [{ path: `src/file${criterionIndex}.ts`, startLine: 1, endLine: 2, excerpt: "evidence" }],
    })),
  },
};

function onChain(intentHash = hash): OnChainIntent {
  return { creator: `0x${"1".repeat(40)}`, intentHash, outcomeHash: ZeroHash, createdAt: 1n, completedAt: 0n, completed: false };
}

function storeLocal(intentHash = hash) {
  localStorage.setItem(intentStorageKey("5"), JSON.stringify({
    intentId: "5",
    creator: `0x${"1".repeat(40)}`,
    canonicalPayload: canonicalizeIntent(canonical),
    intentHash,
    transactionHash: `0x${"2".repeat(64)}`,
    createdAt: 1,
  }));
}

async function load() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Intent ID"), "5");
  await user.click(screen.getByRole("button", { name: "Load intent" }));
  return user;
}

describe("Evaluate page", () => {
  beforeEach(() => {
    mocks.readIntent.mockReset();
    mocks.analyzeEvidence.mockReset();
    mocks.getIntentSealContract.mockReset();
    mocks.parseOutcomeSealed.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    installMockProvider(new MockEip1193Provider({ accounts: [onChain().creator], chainId: BOT_CHAIN.chainIdHex }));
    render(<MemoryRouter><WalletProvider><EvaluatePage /></WalletProvider></MemoryRouter>);
  });

  it("loads the chain intent and verifies the local canonical hash", async () => {
    storeLocal();
    mocks.readIntent.mockResolvedValue(onChain());
    await load();
    expect(await screen.findByText("HASH VERIFIED")).toBeInTheDocument();
    expect(screen.getByText(canonical.title)).toBeInTheDocument();
    expect(mocks.readIntent).toHaveBeenCalledWith(5n);
  });

  it("shows clear errors for missing local content and hash mismatch", async () => {
    mocks.readIntent.mockResolvedValue(onChain());
    const user = await load();
    expect(await screen.findByText("Full intent content is not available in this browser.")).toBeInTheDocument();

    storeLocal(`0x${"4".repeat(64)}`);
    await user.clear(screen.getByLabelText("Intent ID"));
    await user.type(screen.getByLabelText("Intent ID"), "5");
    await user.click(screen.getByRole("button", { name: "Load intent" }));
    expect(await screen.findByText(/does not match the on-chain intent hash/i)).toBeInTheDocument();
  });

  it("shows deterministic analysis stages while evidence collection is pending", async () => {
    storeLocal();
    mocks.readIntent.mockResolvedValue(onChain());
    mocks.analyzeEvidence.mockReturnValue(new Promise(() => undefined));
    const user = await load();
    await user.type(screen.getByLabelText("Repository URL"), "https://github.com/demo/app");
    await user.click(screen.getByRole("button", { name: "Analyze evidence" }));
    expect(screen.getByText("Resolve repository")).toBeInTheDocument();
    expect(screen.getByText("Lock exact commit")).toBeInTheDocument();
    expect(screen.getByText("Apply deterministic rules")).toBeInTheDocument();
  });

  it("renders mixed result cards, commit identity, outcome hash, and persists the draft", async () => {
    storeLocal();
    mocks.readIntent.mockResolvedValue(onChain());
    mocks.analyzeEvidence.mockResolvedValue(analysis);
    const user = await load();
    await user.type(screen.getByLabelText("Repository URL"), "https://github.com/demo/app");
    await user.type(screen.getByLabelText("Branch / ref"), "release");
    await user.click(screen.getByRole("button", { name: "Analyze evidence" }));

    expect(await screen.findByText("Evidence locked to exact commit")).toBeInTheDocument();
    expect(screen.getByText("SATISFIED")).toBeInTheDocument();
    expect(screen.getByText("PARTIAL")).toBeInTheDocument();
    expect(screen.getByText("NOT_FOUND")).toBeInTheDocument();
    expect(screen.getByText(/Draft - not yet sealed/i)).toBeInTheDocument();
    expect(screen.getByText(/Outcome draft hash · Not yet sealed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View immutable commit/i })).toHaveAttribute("href", analysis.outcomeDraft.source.commitUrl);
    expect(mocks.analyzeEvidence).toHaveBeenCalledWith(expect.objectContaining({ repositoryUrl: "https://github.com/demo/app", ref: "release" }));
    await waitFor(() => expect(localStorage.getItem(outcomeStorageKey("5", commit))).not.toBeNull());
  });

  it("requires explicit review and calls completeIntent with the exact local outcome hash", async () => {
    storeLocal();
    const outcomeHash = hashOutcome(analysis.outcomeDraft);
    mocks.readIntent
      .mockResolvedValueOnce(onChain())
      .mockResolvedValueOnce({ ...onChain(), completed: true, outcomeHash, completedAt: 99n });
    mocks.analyzeEvidence.mockResolvedValue(analysis);
    const completeIntent = vi.fn().mockResolvedValue({
      hash: `0x${"9".repeat(64)}`,
      wait: vi.fn().mockResolvedValue({ status: 1, logs: [] }),
    });
    const verifyOutcome = vi.fn().mockResolvedValue(true);
    mocks.getIntentSealContract.mockReturnValue({ completeIntent, verifyOutcome });
    mocks.parseOutcomeSealed.mockReturnValue({ intentId: 5n, outcomeHash, timestamp: 99n });

    const user = await load();
    await user.type(screen.getByLabelText("Repository URL"), "https://github.com/demo/app");
    await user.click(screen.getByRole("button", { name: "Analyze evidence" }));
    const seal = await screen.findByRole("button", { name: "Seal reviewed outcome" });
    expect(seal).toBeDisabled();
    await user.click(screen.getByLabelText(/I reviewed every criterion/i));
    await waitFor(() => expect(seal).toBeEnabled());
    await user.click(seal);

    expect(await screen.findByText("Outcome sealed on BOT Chain")).toBeInTheDocument();
    expect(completeIntent).toHaveBeenCalledWith(5n, outcomeHash);
    expect(verifyOutcome).toHaveBeenCalledWith(5n, outcomeHash);
    const stored = JSON.parse(localStorage.getItem(outcomeStorageKey("5", commit))!);
    expect(stored.seal.outcomeHash).toBe(outcomeHash);
  });

  it("does not show success when outcome readback mismatches", async () => {
    storeLocal();
    const outcomeHash = hashOutcome(analysis.outcomeDraft);
    mocks.readIntent
      .mockResolvedValueOnce(onChain())
      .mockResolvedValueOnce({ ...onChain(), completed: true, outcomeHash: `0x${"f".repeat(64)}`, completedAt: 99n });
    mocks.analyzeEvidence.mockResolvedValue(analysis);
    mocks.getIntentSealContract.mockReturnValue({
      completeIntent: vi.fn().mockResolvedValue({ hash: `0x${"9".repeat(64)}`, wait: vi.fn().mockResolvedValue({ status: 1, logs: [] }) }),
      verifyOutcome: vi.fn(),
    });
    mocks.parseOutcomeSealed.mockReturnValue({ intentId: 5n, outcomeHash, timestamp: 99n });

    const user = await load();
    await user.type(screen.getByLabelText("Repository URL"), "https://github.com/demo/app");
    await user.click(screen.getByRole("button", { name: "Analyze evidence" }));
    await user.click(await screen.findByLabelText(/I reviewed every criterion/i));
    await user.click(screen.getByRole("button", { name: "Seal reviewed outcome" }));

    expect(await screen.findByText(/Integrity verification failed after confirmation/i)).toBeInTheDocument();
    expect(screen.queryByText("Outcome sealed on BOT Chain")).not.toBeInTheDocument();
  });
});
