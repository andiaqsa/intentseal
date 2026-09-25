import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Interface, ZeroHash } from "ethers";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  BOT_CHAIN,
  INTENTSEAL_CONTRACT_ADDRESS,
  contractExplorerUrl,
  transactionExplorerUrl,
} from "../../config/network";
import { INTENTSEAL_ABI } from "../../lib/blockchain/abi";
import {
  canonicalizeIntent,
  hashCanonicalPayload,
} from "../../lib/canonical/intent";
import { intentStorageKey } from "../../lib/storage/intents";
import {
  installMockProvider,
  MockEip1193Provider,
  providerError,
} from "../../test/mockEip1193Provider";
import type {
  IntentInput,
  OnChainIntent,
} from "../../types/intent";
import { WalletProvider } from "../wallet/WalletContext";
import { VerifyPage } from "../verify/VerifyPage";
import { CreateIntentPage } from "./CreateIntentPage";

const blockchain = vi.hoisted(() => ({
  createIntent: vi.fn(),
  getIntentSealContract: vi.fn(),
  readIntent: vi.fn(),
}));

vi.mock(
  "../../lib/blockchain/contract",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../lib/blockchain/contract")
      >();

    return {
      ...actual,
      getIntentSealContract:
        blockchain.getIntentSealContract,
      readIntent: blockchain.readIntent,
    };
  },
);

const ACCOUNT =
  "0x1111111111111111111111111111111111111111";

const TX_HASH = `0x${"a".repeat(64)}`;

const TIMESTAMP = 1_740_000_000n;

const OTHER_HASH = `0x${"f".repeat(64)}`;

const testIntent: IntentInput = {
  title: "Add API rate limiting",
  goal:
    "Implement login endpoint rate limiting before completing the task.",
  criteria: [
    "Maximum 5 login attempts per minute per IP",
    "Return HTTP 429 when the limit is exceeded",
    "Add automated tests for rate limiting",
  ],
};

function deferred<T>() {
  let resolve!: (
    value: T | PromiseLike<T>,
  ) => void;

  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    },
  );

  return {
    promise,
    resolve,
    reject,
  };
}

function eventReceipt(
  intentHash: string,
  eventHash = intentHash,
  logs = true,
) {
  const contractInterface = new Interface(
    INTENTSEAL_ABI,
  );

  const event =
    contractInterface.encodeEventLog(
      contractInterface.getEvent(
        "IntentSealed",
      )!,
      [
        5n,
        ACCOUNT,
        eventHash,
        TIMESTAMP,
      ],
    );

  return {
    status: 1,

    logs: logs
      ? [
          {
            address:
              INTENTSEAL_CONTRACT_ADDRESS,
            topics: event.topics,
            data: event.data,
          },
        ]
      : [],
  };
}

function matchingIntent(
  intentHash: string,
): OnChainIntent {
  return {
    creator: ACCOUNT,
    intentHash,
    outcomeHash: ZeroHash,
    createdAt: TIMESTAMP,
    completedAt: 0n,
    completed: false,
  };
}

function renderCreate(
  chainId: string = BOT_CHAIN.chainIdHex,
) {
  const provider =
    new MockEip1193Provider({
      accounts: [ACCOUNT],
      chainId,
    });

  installMockProvider(provider);

  const view = render(
    <WalletProvider>
      <CreateIntentPage />
    </WalletProvider>,
  );

  return {
    provider,
    ...view,
  };
}

async function completeForm(
  user: ReturnType<
    typeof userEvent.setup
  >,
) {
  const manualButton =
    screen.queryByRole("button", {
      name: /Write manually/,
    });

  if (manualButton) {
    await user.click(manualButton);
  }

  fireEvent.change(
    screen.getByLabelText("Title"),
    {
      target: {
        value: testIntent.title,
      },
    },
  );

  fireEvent.change(
    screen.getByLabelText("Goal"),
    {
      target: {
        value: testIntent.goal,
      },
    },
  );

  fireEvent.change(
    screen.getByLabelText("Criterion 1"),
    {
      target: {
        value: testIntent.criteria[0],
      },
    },
  );

  await user.click(
    screen.getByRole("button", {
      name: "Add criterion",
    }),
  );

  fireEvent.change(
    screen.getByLabelText("Criterion 2"),
    {
      target: {
        value: testIntent.criteria[1],
      },
    },
  );

  await user.click(
    screen.getByRole("button", {
      name: "Add criterion",
    }),
  );

  fireEvent.change(
    screen.getByLabelText("Criterion 3"),
    {
      target: {
        value: testIntent.criteria[2],
      },
    },
  );
}

async function reachReview(
  user: ReturnType<
    typeof userEvent.setup
  >,
) {
  await completeForm(user);

  expect(
    blockchain.createIntent,
  ).not.toHaveBeenCalled();

  await user.click(
    screen.getByRole("button", {
      name: /Review intent/,
    }),
  );

  await screen.findByText(
    "Canonical payload",
  );
}

async function approveReview(
  user: ReturnType<
    typeof userEvent.setup
  >,
) {
  await user.click(
    screen.getByRole("checkbox", {
      name: /reviewed the exact content/i,
    }),
  );
}

function configureSuccessfulWrite() {
  blockchain.createIntent.mockImplementation(
    async (intentHash: string) => ({
      hash: TX_HASH,

      wait: vi
        .fn()
        .mockResolvedValue(
          eventReceipt(intentHash),
        ),
    }),
  );

  blockchain.readIntent.mockImplementation(
    async () => {
      const intentHash =
        blockchain.createIntent.mock
          .calls[0][0] as string;

      return matchingIntent(intentHash);
    },
  );
}

describe(
  "Create Intent review and sealing flow",
  () => {
    beforeEach(() => {
      blockchain.createIntent.mockReset();
      blockchain.readIntent.mockReset();
      blockchain.getIntentSealContract.mockReset();

      blockchain.getIntentSealContract.mockReturnValue(
        {
          createIntent:
            blockchain.createIntent,
        },
      );

      vi.spyOn(
        console,
        "error",
      ).mockImplementation(
        () => undefined,
      );
    });

    it(
      "renders the exact canonical payload and its bytes32 hash before signing",
      async () => {
        const user = userEvent.setup();

        renderCreate();

        await reachReview(user);

        const canonicalPayload =
          canonicalizeIntent(testIntent);

        const expectedHash =
          hashCanonicalPayload(
            canonicalPayload,
          );

        expect(
          screen.getByText(
            testIntent.title,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            testIntent.goal,
          ),
        ).toBeInTheDocument();

        for (
          const criterion of
          testIntent.criteria
        ) {
          expect(
            screen.getByText(criterion),
          ).toBeInTheDocument();
        }

        expect(
          screen.getByText(
            canonicalPayload,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            expectedHash,
          ),
        ).toBeInTheDocument();

        expect(
          expectedHash,
        ).toMatch(
          /^0x[0-9a-f]{64}$/,
        );

        expect(
          hashCanonicalPayload(
            screen.getByText(
              canonicalPayload,
            ).textContent!,
          ),
        ).toBe(expectedHash);

        expect(
          blockchain.createIntent,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "changes the reviewed hash when one criterion changes",
      async () => {
        const user = userEvent.setup();

        renderCreate();

        await reachReview(user);

        const originalHash =
          hashCanonicalPayload(
            canonicalizeIntent(
              testIntent,
            ),
          );

        expect(
          screen.getByText(
            originalHash,
          ),
        ).toBeInTheDocument();

        await user.click(
          screen.getByRole("button", {
            name: /Back to edit/,
          }),
        );

        const thirdCriterion =
          screen.getByLabelText(
            "Criterion 3",
          );

        fireEvent.change(
          thirdCriterion,
          {
            target: {
              value:
                "Add integration tests for rate limiting",
            },
          },
        );

        await user.click(
          screen.getByRole("button", {
            name: /Review intent/,
          }),
        );

        const changedPayload =
          canonicalizeIntent({
            ...testIntent,

            criteria: [
              testIntent.criteria[0],
              testIntent.criteria[1],
              "Add integration tests for rate limiting",
            ],
          });

        const changedHash =
          hashCanonicalPayload(
            changedPayload,
          );

        expect(
          changedHash,
        ).not.toBe(originalHash);

        expect(
          screen.getByText(
            changedHash,
          ),
        ).toBeInTheDocument();
      },
    );

    it(
      "requires explicit review confirmation and blocks sealing on the wrong network",
      async () => {
        const user = userEvent.setup();

        renderCreate("0x1");

        await reachReview(user);

        const sealButton =
          screen.getByRole("button", {
            name: /Seal intent on-chain/,
          });

        expect(
          sealButton,
        ).toBeDisabled();

        await approveReview(user);

        expect(
          sealButton,
        ).toBeDisabled();

        expect(
          screen.getByText(
            "Action required",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole("button", {
            name: "Switch to BOT Chain",
          }),
        ).toBeInTheDocument();

        expect(
          blockchain.createIntent,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "shows every transaction state and prevents duplicate submission",
      async () => {
        const user = userEvent.setup();

        const { provider } =
          renderCreate();

        await reachReview(user);
        await approveReview(user);

        await waitFor(() =>
          expect(
            screen.getByText(
              BOT_CHAIN.chainName,
            ),
          ).toBeInTheDocument(),
        );

        const signerGate =
          deferred<string[]>();

        provider.setHandler(
          "eth_accounts",
          () =>
            signerGate.promise,
        );

        const approvalGate =
          deferred<{
            hash: string;

            wait: () => Promise<
              ReturnType<
                typeof eventReceipt
              >
            >;
          }>();

        blockchain.createIntent.mockReturnValue(
          approvalGate.promise,
        );

        const confirmationGate =
          deferred<
            ReturnType<
              typeof eventReceipt
            >
          >();

        blockchain.readIntent.mockImplementation(
          async () => {
            const hash =
              blockchain.createIntent
                .mock.calls[0][0] as string;

            return matchingIntent(hash);
          },
        );

        let frameCallback:
          | FrameRequestCallback
          | undefined;

        vi.spyOn(
          window,
          "requestAnimationFrame",
        ).mockImplementation(
          (callback) => {
            frameCallback = callback;
            return 1;
          },
        );

        const sealButton =
          screen.getByRole("button", {
            name: /Seal intent on-chain/,
          });

        expect(
          sealButton,
        ).toBeEnabled();

        expect(
          screen.queryByText(
            "Preparing proof",
          ),
        ).not.toBeInTheDocument();

        await user.click(
          sealButton,
        );

        expect(
          (
            await screen.findAllByText(
              "Preparing proof",
            )
          ).length,
        ).toBeGreaterThan(0);

        expect(
          localStorage.length,
        ).toBe(0);

        signerGate.resolve([
          ACCOUNT,
        ]);

        expect(
          (
            await screen.findAllByText(
              "Waiting for wallet approval",
            )
          ).length,
        ).toBeGreaterThan(0);

        expect(
          screen.getByRole("button", {
            name: /Waiting for wallet approval/,
          }),
        ).toBeDisabled();

        await user.click(
          screen.getByRole("button", {
            name: /Waiting for wallet approval/,
          }),
        );

        expect(
          blockchain.createIntent,
        ).toHaveBeenCalledTimes(
          1,
        );

        approvalGate.resolve({
          hash: TX_HASH,

          wait: () =>
            confirmationGate.promise,
        });

        expect(
          (
            await screen.findAllByText(
              "Transaction submitted",
            )
          ).length,
        ).toBeGreaterThan(0);

        expect(
          screen.getByText(TX_HASH),
        ).toBeInTheDocument();

        expect(
          localStorage.length,
        ).toBe(0);

        act(() =>
          frameCallback?.(
            performance.now(),
          ),
        );

        expect(
          (
            await screen.findAllByText(
              "Waiting for confirmation",
            )
          ).length,
        ).toBeGreaterThan(0);

        expect(
          localStorage.length,
        ).toBe(0);

        const intentHash =
          blockchain.createIntent
            .mock.calls[0][0] as string;

        confirmationGate.resolve(
          eventReceipt(intentHash),
        );

        expect(
          await screen.findByText(
            "Created before outcome",
          ),
        ).toBeInTheDocument();

        expect(
          localStorage.length,
        ).toBe(1);
      },
    );

    it(
      "parses IntentSealed ID 5, verifies readback, shows centralized links, and persists locally",
      async () => {
        const user = userEvent.setup();

        configureSuccessfulWrite();

        renderCreate();

        await reachReview(user);
        await approveReview(user);

        await user.click(
          screen.getByRole("button", {
            name: /Seal intent on-chain/,
          }),
        );

        expect(
          await screen.findByText(
            "Created before outcome",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText("#5"),
        ).toBeInTheDocument();

        expect(
          screen.getByText(ACCOUNT),
        ).toBeInTheDocument();

        expect(
          screen.getAllByText(
            TX_HASH,
          ).length,
        ).toBeGreaterThan(0);

        const intentHash =
          hashCanonicalPayload(
            canonicalizeIntent(
              testIntent,
            ),
          );

        expect(
          screen.getByText(
            intentHash,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole("link", {
            name: /View transaction/,
          }),
        ).toHaveAttribute(
          "href",
          transactionExplorerUrl(
            TX_HASH,
          ),
        );

        expect(
          screen.getByRole("link", {
            name: /View contract/,
          }),
        ).toHaveAttribute(
          "href",
          contractExplorerUrl(),
        );

        expect(
          blockchain.readIntent,
        ).toHaveBeenCalledWith(
          5n,
          expect.anything(),
        );

        const key =
          `intentseal:${BOT_CHAIN.chainId}:${INTENTSEAL_CONTRACT_ADDRESS.toLowerCase()}:5`;

        expect(
          intentStorageKey("5"),
        ).toBe(key);

        expect(
          JSON.parse(
            localStorage.getItem(
              key,
            )!,
          ),
        ).toEqual({
          intentId: "5",
          creator: ACCOUNT,

          canonicalPayload:
            canonicalizeIntent(
              testIntent,
            ),

          intentHash,

          transactionHash:
            TX_HASH,

          createdAt:
            Number(TIMESTAMP),
        });
      },
    );

    it(
      "restores successfully persisted intent data after a simulated application reload",
      async () => {
        const user = userEvent.setup();

        configureSuccessfulWrite();

        const view =
          renderCreate();

        await reachReview(user);
        await approveReview(user);

        await user.click(
          screen.getByRole("button", {
            name: /Seal intent on-chain/,
          }),
        );

        await screen.findByText(
          "Created before outcome",
        );

        view.unmount();

        render(
          <VerifyPage />,
        );

        await user.type(
          screen.getByLabelText(
            "Intent ID",
          ),
          "5",
        );

        await user.click(
          screen.getByRole("button", {
            name: "Verify",
          }),
        );

        expect(
          await screen.findByText(
            "Local intent available",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            canonicalizeIntent(
              testIntent,
            ),
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /local application data in this browser/i,
          ),
        ).toBeInTheDocument();
      },
    );

    it(
      "rejects an event hash mismatch without readback, success, or persistence",
      async () => {
        const user =
          userEvent.setup();

        blockchain.createIntent.mockImplementation(
          async (
            intentHash: string,
          ) => ({
            hash: TX_HASH,

            wait: vi
              .fn()
              .mockResolvedValue(
                eventReceipt(
                  intentHash,
                  OTHER_HASH,
                ),
              ),
          }),
        );

        renderCreate();

        await reachReview(user);
        await approveReview(user);

        await user.click(
          screen.getByRole("button", {
            name: /Seal intent on-chain/,
          }),
        );

        expect(
          await screen.findByText(
            /Integrity check failed/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Created before outcome",
          ),
        ).not.toBeInTheDocument();

        expect(
          blockchain.readIntent,
        ).not.toHaveBeenCalled();

        expect(
          localStorage.length,
        ).toBe(0);
      },
    );

    it(
      "rejects a getIntent hash mismatch without success or persistence",
      async () => {
        const user =
          userEvent.setup();

        blockchain.createIntent.mockImplementation(
          async (
            intentHash: string,
          ) => ({
            hash: TX_HASH,

            wait: vi
              .fn()
              .mockResolvedValue(
                eventReceipt(
                  intentHash,
                ),
              ),
          }),
        );

        blockchain.readIntent.mockResolvedValue(
          matchingIntent(
            OTHER_HASH,
          ),
        );

        renderCreate();

        await reachReview(user);
        await approveReview(user);

        await user.click(
          screen.getByRole("button", {
            name: /Seal intent on-chain/,
          }),
        );

        expect(
          await screen.findByText(
            /Integrity check failed/,
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Created before outcome",
          ),
        ).not.toBeInTheDocument();

        expect(
          localStorage.length,
        ).toBe(0);
      },
    );

    it(
      "handles transaction rejection as retryable while preserving the reviewed intent",
      async () => {
        const user =
          userEvent.setup();

        blockchain.createIntent.mockRejectedValue(
          providerError(
            4001,
            "User rejected request",
          ),
        );

        renderCreate();

        await reachReview(user);
        await approveReview(user);

        await user.click(
          screen.getByRole("button", {
            name: /Seal intent on-chain/,
          }),
        );

        expect(
          await screen.findByText(
            "The transaction was cancelled in MetaMask.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole("button", {
            name: /Try again/,
          }),
        ).toBeEnabled();

        expect(
          screen.getAllByText(
            "Transaction failed",
          ).length,
        ).toBeGreaterThan(0);

        expect(
          screen.getByText(
            testIntent.title,
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText("#5"),
        ).not.toBeInTheDocument();

        expect(
          screen.queryByText(
            "Created before outcome",
          ),
        ).not.toBeInTheDocument();

        expect(
          screen.queryByRole("link", {
            name: /View transaction/,
          }),
        ).not.toBeInTheDocument();

        expect(
          localStorage.length,
        ).toBe(0);

        configureSuccessfulWrite();

        await user.click(
          screen.getByRole("button", {
            name: /Try again/,
          }),
        );

        expect(
          await screen.findByText(
            "Created before outcome",
          ),
        ).toBeInTheDocument();
      },
    );

    it.each([
      {
        name:
          "insufficient funds",

        configure: () =>
          blockchain.createIntent.mockRejectedValue(
            new Error(
              "insufficient funds for gas",
            ),
          ),

        expected:
          "This wallet does not have enough BOT",
      },

      {
        name:
          "reverted receipt",

        configure: () =>
          blockchain.createIntent.mockResolvedValue(
            {
              hash: TX_HASH,

              wait: async () => ({
                status: 0,
                logs: [],
              }),
            },
          ),

        expected:
          "The transaction could not be completed",
      },

      {
        name:
          "unavailable receipt",

        configure: () =>
          blockchain.createIntent.mockResolvedValue(
            {
              hash: TX_HASH,

              wait: async () =>
                null,
            },
          ),

        expected:
          "The transaction could not be completed",
      },

      {
        name:
          "missing IntentSealed event",

        configure: () =>
          blockchain.createIntent.mockImplementation(
            async (
              hash: string,
            ) => ({
              hash: TX_HASH,

              wait:
                async () =>
                  eventReceipt(
                    hash,
                    hash,
                    false,
                  ),
            }),
          ),

        expected:
          "IntentSealed event could not be verified",
      },
    ])(
      "fails safely for $name",
      async ({
        configure,
        expected,
      }) => {
        const user =
          userEvent.setup();

        configure();

        renderCreate();

        await reachReview(user);
        await approveReview(user);

        await user.click(
          screen.getByRole("button", {
            name: /Seal intent on-chain/,
          }),
        );

        expect(
          await screen.findByText(
            new RegExp(
              expected,
            ),
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Created before outcome",
          ),
        ).not.toBeInTheDocument();

        expect(
          localStorage.length,
        ).toBe(0);
      },
    );

    it.each([
      {
        name:
          "getIntent RPC failure",

        value:
          new Error(
            "RPC failed to fetch",
          ),
      },

      {
        name:
          "invalid contract result",

        value:
          new Error(
            "INVALID_CONTRACT_RESULT",
          ),
      },
    ])(
      "does not persist when $name occurs",
      async ({ value }) => {
        const user =
          userEvent.setup();

        blockchain.createIntent.mockImplementation(
          async (
            intentHash: string,
          ) => ({
            hash: TX_HASH,

            wait: async () =>
              eventReceipt(
                intentHash,
              ),
          }),
        );

        blockchain.readIntent.mockRejectedValue(
          value,
        );

        renderCreate();

        await reachReview(user);
        await approveReview(user);

        await user.click(
          screen.getByRole("button", {
            name: /Seal intent on-chain/,
          }),
        );

        expect(
          await screen.findByText(
            /could not be completed|could not be reached/,
          ),
        ).toBeInTheDocument();

        expect(
          localStorage.length,
        ).toBe(0);
      },
    );
  },
);