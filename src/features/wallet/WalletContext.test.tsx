import {
  act,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { BOT_CHAIN } from "../../config/network";
import {
  installMockProvider,
  MockEip1193Provider,
  providerError,
} from "../../test/mockEip1193Provider";
import { WalletProvider } from "./WalletContext";
import { useWallet } from "./wallet-context";

const ACCOUNT =
  "0x1111111111111111111111111111111111111111";

const SECOND_ACCOUNT =
  "0x2222222222222222222222222222222222222222";

function WalletHarness() {
  const wallet = useWallet();

  return (
    <div>
      <span data-testid="account">
        {wallet.account ?? "none"}
      </span>

      <span data-testid="connection">
        {wallet.connectionState}
      </span>

      <span data-testid="network">
        {wallet.isCorrectNetwork
          ? BOT_CHAIN.chainName
          : "Wrong network"}
      </span>

      {wallet.error && (
        <span role="alert">{wallet.error}</span>
      )}

      <button onClick={() => void wallet.connect()}>
        Connect
      </button>

      <button onClick={() => void wallet.switchNetwork()}>
        Switch Network
      </button>
    </div>
  );
}

function renderWallet(
  provider?: MockEip1193Provider,
) {
  installMockProvider(provider);

  return render(
    <WalletProvider>
      <WalletHarness />
    </WalletProvider>,
  );
}

describe("WalletProvider and BOT Chain network behavior", () => {
  beforeEach(() => {
    installMockProvider();

    vi.spyOn(console, "error").mockImplementation(
      () => undefined,
    );
  });

  it("recognizes an already connected wallet on BOT Chain Mainnet without switching", async () => {
    const provider = new MockEip1193Provider({
      accounts: [ACCOUNT],
      chainId: BOT_CHAIN.chainIdHex,
    });

    renderWallet(provider);

    await waitFor(() =>
      expect(
        screen.getByTestId("account"),
      ).toHaveTextContent(ACCOUNT),
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("network"),
      ).toHaveTextContent(BOT_CHAIN.chainName),
    );

    expect(
      screen.getByTestId("connection"),
    ).toHaveTextContent("connected");

    expect(
      provider.requestsFor(
        "wallet_switchEthereumChain",
      ),
    ).toHaveLength(0);
  });

  it("reports a wrong network until the user explicitly switches", async () => {
    const provider = new MockEip1193Provider({
      accounts: [ACCOUNT],
      chainId: "0x1",
    });

    renderWallet(provider);

    await waitFor(() =>
      expect(
        screen.getByTestId("connection"),
      ).toHaveTextContent("connected"),
    );

    expect(
      screen.getByTestId("network"),
    ).toHaveTextContent("Wrong network");

    expect(
      provider.requestsFor(
        "wallet_switchEthereumChain",
      ),
    ).toHaveLength(0);
  });

  it("switches using the centralized BOT Chain Mainnet ID and updates the UI", async () => {
    const user = userEvent.setup();

    const provider = new MockEip1193Provider({
      accounts: [ACCOUNT],
      chainId: "0x1",
    });

    renderWallet(provider);

    await waitFor(() =>
      expect(
        screen.getByTestId("network"),
      ).toHaveTextContent("Wrong network"),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Switch Network",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("network"),
      ).toHaveTextContent(BOT_CHAIN.chainName),
    );

    expect(
      provider.requestsFor(
        "wallet_switchEthereumChain",
      ),
    ).toEqual([
      {
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: BOT_CHAIN.chainIdHex,
          },
        ],
      },
    ]);
  });

  it("adds BOT Chain Mainnet with the centralized configuration after error 4902", async () => {
    const user = userEvent.setup();

    const provider = new MockEip1193Provider({
      accounts: [ACCOUNT],
      chainId: "0x1",
      switchError: providerError(
        4902,
        "Unknown chain",
      ),
    });

    renderWallet(provider);

    await waitFor(() =>
      expect(
        screen.getByTestId("network"),
      ).toHaveTextContent("Wrong network"),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Switch Network",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("network"),
      ).toHaveTextContent(BOT_CHAIN.chainName),
    );

    expect(
      provider.requestsFor(
        "wallet_addEthereumChain",
      ),
    ).toEqual([
      {
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BOT_CHAIN.chainIdHex,
            chainName: BOT_CHAIN.chainName,
            nativeCurrency:
              BOT_CHAIN.nativeCurrency,
            rpcUrls: [BOT_CHAIN.rpcUrl],
            blockExplorerUrls: [
              BOT_CHAIN.explorerUrl,
            ],
          },
        ],
      },
    ]);
  });

  it("keeps writes blocked on the wrong network when switching is rejected", async () => {
    const user = userEvent.setup();

    const provider = new MockEip1193Provider({
      accounts: [ACCOUNT],
      chainId: "0x1",
      switchError: providerError(
        4001,
        "User rejected request",
      ),
    });

    renderWallet(provider);

    await waitFor(() =>
      expect(
        screen.getByTestId("network"),
      ).toHaveTextContent("Wrong network"),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Switch Network",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "The network switch was cancelled in MetaMask.",
    );

    expect(
      screen.getByTestId("network"),
    ).toHaveTextContent("Wrong network");
  });

  it("reacts immediately to account, chain, and disconnect events", async () => {
    const provider = new MockEip1193Provider({
      accounts: [ACCOUNT],
      chainId: "0x1",
    });

    renderWallet(provider);

    await waitFor(() =>
      expect(
        screen.getByTestId("account"),
      ).toHaveTextContent(ACCOUNT),
    );

    act(() =>
      provider.emit(
        "accountsChanged",
        [SECOND_ACCOUNT],
      ),
    );

    expect(
      screen.getByTestId("account"),
    ).toHaveTextContent(SECOND_ACCOUNT);

    act(() =>
      provider.emit(
        "chainChanged",
        BOT_CHAIN.chainIdHex,
      ),
    );

    expect(
      screen.getByTestId("network"),
    ).toHaveTextContent(BOT_CHAIN.chainName);

    act(() =>
      provider.emit("accountsChanged", []),
    );

    expect(
      screen.getByTestId("account"),
    ).toHaveTextContent("none");

    expect(
      screen.getByTestId("connection"),
    ).toHaveTextContent("disconnected");

    act(() =>
      provider.emit("accountsChanged", [ACCOUNT]),
    );

    act(() =>
      provider.emit(
        "disconnect",
        providerError(4900, "Disconnected"),
      ),
    );

    expect(
      screen.getByTestId("account"),
    ).toHaveTextContent("none");

    expect(
      screen.getByTestId("connection"),
    ).toHaveTextContent("disconnected");
  });

  it("removes all wallet event listeners when unmounted", async () => {
    const provider = new MockEip1193Provider({
      accounts: [ACCOUNT],
      chainId: BOT_CHAIN.chainIdHex,
    });

    const view = renderWallet(provider);

    await waitFor(() =>
      expect(
        provider.listenerCount(
          "accountsChanged",
        ),
      ).toBe(1),
    );

    expect(
      provider.listenerCount("chainChanged"),
    ).toBe(1);

    expect(
      provider.listenerCount("disconnect"),
    ).toBe(1);

    view.unmount();

    expect(
      provider.listenerCount(
        "accountsChanged",
      ),
    ).toBe(0);

    expect(
      provider.listenerCount("chainChanged"),
    ).toBe(0);

    expect(
      provider.listenerCount("disconnect"),
    ).toBe(0);
  });

  it("handles unavailable MetaMask and rejected account access without crashing", async () => {
    const user = userEvent.setup();

    renderWallet();

    expect(
      screen.getByTestId("connection"),
    ).toHaveTextContent("unavailable");

    await user.click(
      screen.getByRole("button", {
        name: "Connect",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "MetaMask is not installed",
    );

    const rejectedProvider =
      new MockEip1193Provider({
        accounts: [],
        requestAccountsError: providerError(
          4001,
          "User rejected request",
        ),
      });

    renderWallet(rejectedProvider);

    await user.click(
      screen.getAllByRole("button", {
        name: "Connect",
      })[1],
    );

    expect(
      (
        await screen.findAllByRole("alert")
      )[1],
    ).toHaveTextContent(
      "The wallet connection was cancelled.",
    );

    expect(
      screen.getAllByTestId("connection")[1],
    ).toHaveTextContent("disconnected");
  });
});