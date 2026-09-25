import {
  BrowserProvider,
  JsonRpcProvider,
} from "ethers";

import { BOT_CHAIN } from "../../config/network";

let readProvider: JsonRpcProvider | undefined;

export function getReadProvider(): JsonRpcProvider {
  readProvider ??= new JsonRpcProvider(
    BOT_CHAIN.rpcUrl,
    {
      chainId: BOT_CHAIN.chainId,
      name: BOT_CHAIN.chainName,
    },
  );

  return readProvider;
}

export function getBrowserProvider(): BrowserProvider {
  if (!window.ethereum?.isMetaMask) {
    throw new Error("METAMASK_UNAVAILABLE");
  }

  return new BrowserProvider(
    window.ethereum,
    "any",
  );
}

export async function getInjectedChainId(): Promise<
  string | null
> {
  if (!window.ethereum?.isMetaMask) {
    return null;
  }

  return (await window.ethereum.request({
    method: "eth_chainId",
  })) as string;
}

export async function switchToBotChain(): Promise<void> {
  if (!window.ethereum?.isMetaMask) {
    throw new Error("METAMASK_UNAVAILABLE");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: BOT_CHAIN.chainIdHex,
        },
      ],
    });
  } catch (error) {
    const code = getProviderErrorCode(error);

    if (code !== 4902) {
      throw error;
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BOT_CHAIN.chainIdHex,
          chainName: BOT_CHAIN.chainName,
          nativeCurrency: BOT_CHAIN.nativeCurrency,
          rpcUrls: [BOT_CHAIN.rpcUrl],
          blockExplorerUrls: [
            BOT_CHAIN.explorerUrl,
          ],
        },
      ],
    });
  }
}

function getProviderErrorCode(
  error: unknown,
): number | undefined {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return undefined;
  }

  if (
    "code" in error &&
    typeof error.code === "number"
  ) {
    return error.code;
  }

  if ("data" in error) {
    return getProviderErrorCode(error.data);
  }

  return undefined;
}