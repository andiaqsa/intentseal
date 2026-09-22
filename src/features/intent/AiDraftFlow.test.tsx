import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOT_CHAIN } from "../../config/network";
import { canonicalizeIntent, hashCanonicalPayload } from "../../lib/canonical/intent";
import { installMockProvider, MockEip1193Provider } from "../../test/mockEip1193Provider";
import type { IntentInput } from "../../types/intent";
import { WalletProvider } from "../wallet/WalletContext";
import { CreateIntentPage } from "./CreateIntentPage";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const roughIntent =
  "Add rate limiting to login so repeated brute-force attempts are blocked, return a useful error, and add tests.";
const aiDraft: IntentInput = {
  title: "Add login rate limiting",
  goal: "Implement rate limiting for login attempts to reduce excessive repeated requests.",
  criteria: [
    "Login attempts are constrained by an explicit threshold and time window.",
    "Requests exceeding the configured limit receive a rate-limit response.",
    "Automated tests cover allowed and rate-limited requests.",
  ],
};

function renderCreate() {
  const provider = new MockEip1193Provider({
    accounts: [ACCOUNT],
    chainId: BOT_CHAIN.chainIdHex,
  });
  installMockProvider(provider);
  render(
    <WalletProvider>
      <CreateIntentPage />
    </WalletProvider>,
  );
  return provider;
}

function successfulFetch() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(aiDraft), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function requestDraft(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText("What are you planning to do?"), {
    target: { value: roughIntent },
  });
  await user.click(screen.getByRole("button", { name: "Structure with AI" }));
  await screen.findByText("Review structured intent");
}

describe("AI-assisted intent drafting", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("offers AI and manual modes and sends the expected rough-intent request", async () => {
    const user = userEvent.setup();
    const fetchMock = successfulFetch();
    const provider = renderCreate();

    expect(screen.getByText("Describe your intent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write manually" })).toBeInTheDocument();
    await requestDraft(user);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intent/structure",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: roughIntent }),
      }),
    );
    expect(screen.getByLabelText("Title")).toHaveValue(aiDraft.title);
    expect(screen.getByLabelText("Goal")).toHaveValue(aiDraft.goal);
    aiDraft.criteria.forEach((criterion, index) => {
      expect(screen.getByLabelText(`Criterion ${index + 1}`)).toHaveValue(criterion);
    });
    expect(screen.queryByText("Keccak-256 hash")).not.toBeInTheDocument();
    expect(provider.requestsFor("eth_requestAccounts")).toHaveLength(0);
    expect(provider.requestsFor("eth_sendTransaction")).toHaveLength(0);
  });

  it("keeps every generated field editable and hashes only the edited review version", async () => {
    const user = userEvent.setup();
    successfulFetch();
    renderCreate();
    await requestDraft(user);

    const edited: IntentInput = {
      title: "Add robust login rate limiting",
      goal: "Implement configurable rate limiting for the login endpoint.",
      criteria: [
        aiDraft.criteria[0],
        "Rate-limited requests return an explicit HTTP 429 response.",
        aiDraft.criteria[2],
        "Configuration is documented for operators.",
      ],
    };
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: edited.title } });
    fireEvent.change(screen.getByLabelText("Goal"), { target: { value: edited.goal } });
    fireEvent.change(screen.getByLabelText("Criterion 2"), {
      target: { value: edited.criteria[1] },
    });
    await user.click(screen.getByRole("button", { name: "Add criterion" }));
    fireEvent.change(screen.getByLabelText("Criterion 4"), {
      target: { value: edited.criteria[3] },
    });
    expect(screen.getByRole("button", { name: "Remove criterion 4" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /Review intent/ }));
    const canonicalPayload = canonicalizeIntent(edited);
    const editedHash = hashCanonicalPayload(canonicalPayload);
    expect(screen.getByText(canonicalPayload)).toBeInTheDocument();
    expect(screen.getByText(editedHash)).toBeInTheDocument();
    expect(editedHash).not.toBe(hashCanonicalPayload(canonicalizeIntent(aiDraft)));
  });

  it("supports removing criteria and preserves rough input when regenerating", async () => {
    const user = userEvent.setup();
    successfulFetch();
    renderCreate();
    await requestDraft(user);

    await user.click(screen.getByRole("button", { name: "Remove criterion 2" }));
    expect(screen.getAllByLabelText(/Criterion \d/)).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(screen.getByLabelText("What are you planning to do?")).toHaveValue(roughIntent);
  });

  it("blocks duplicate AI requests while loading", async () => {
    const user = userEvent.setup();
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderCreate();
    fireEvent.change(screen.getByLabelText("What are you planning to do?"), {
      target: { value: roughIntent },
    });

    await user.click(screen.getByRole("button", { name: "Structure with AI" }));
    const loadingButton = screen.getByRole("button", { name: /Structuring intent/ });
    expect(loadingButton).toBeDisabled();
    await user.click(loadingButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse(new Response(JSON.stringify(aiDraft), { status: 200 }));
    expect(await screen.findByText("Review structured intent")).toBeInTheDocument();
  });

  it("shows a friendly failure, preserves rough input, and falls back to manual mode", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { error: { code: "AI_UNAVAILABLE", message: "AI couldn't structure this intent." } },
        { status: 502 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderCreate();
    fireEvent.change(screen.getByLabelText("What are you planning to do?"), {
      target: { value: roughIntent },
    });
    await user.click(screen.getByRole("button", { name: "Structure with AI" }));

    expect(await screen.findByText("AI couldn't structure this intent.")).toBeInTheDocument();
    expect(screen.getByLabelText("What are you planning to do?")).toHaveValue(roughIntent);
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Write manually" }));
    expect(screen.getByText("Write intent manually")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the server timeout message, keeps manual fallback, and never opens MetaMask", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            code: "AI_TIMEOUT",
            message: "AI couldn't structure this intent in time.",
          },
        },
        { status: 504 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = renderCreate();
    fireEvent.change(screen.getByLabelText("What are you planning to do?"), {
      target: { value: roughIntent },
    });

    await user.click(screen.getByRole("button", { name: "Structure with AI" }));

    expect(await screen.findByText("AI couldn't structure this intent in time.")).toBeInTheDocument();
    expect(screen.getByLabelText("What are you planning to do?")).toHaveValue(roughIntent);
    expect(screen.getByRole("button", { name: "Write manually" })).toBeEnabled();
    expect(provider.requestsFor("eth_requestAccounts")).toHaveLength(0);
    expect(provider.requestsFor("eth_sendTransaction")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Write manually" }));
    expect(screen.getByText("Write intent manually")).toBeInTheDocument();
  });

  it("keeps the complete manual path independent from AI", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderCreate();
    await user.click(screen.getByRole("button", { name: "Write manually" }));

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Manual intent" } });
    fireEvent.change(screen.getByLabelText("Goal"), {
      target: { value: "Create a complete intent without AI assistance." },
    });
    fireEvent.change(screen.getByLabelText("Criterion 1"), {
      target: { value: "The manual flow reaches canonical review." },
    });
    await user.click(screen.getByRole("button", { name: /Review intent/ }));

    expect(await screen.findByText("Canonical payload")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/intentseal.intent.v1/)).toBeInTheDocument());
  });
});
