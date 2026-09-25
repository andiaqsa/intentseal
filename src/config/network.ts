import { getAddress } from "ethers";

export const BOT_CHAIN_TESTNET = Object.freeze({
  chainId: 968,
  chainIdHex: "0x3c8",
  chainName: "BOT Chain Testnet",
  rpcUrl: "https://rpc.bohr.life",
  explorerUrl: "https://scan.bohr.life",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  contractAddress: getAddress(
    "0x5f776464dfffbB0699ef6395f8d2b6088a617c1a".toLowerCase(),
  ),
});

export const BOT_CHAIN_MAINNET = Object.freeze({
  chainId: 677,
  chainIdHex: "0x2a5",
  chainName: "BOT Chain Mainnet",
  rpcUrl: "https://rpc.botchain.ai",
  explorerUrl: "https://scan.botchain.ai",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  contractAddress: getAddress(
    "0xe11b90f99876e020caa17a76f09cf29fee0f5656",
  ),
});

/**
 * Active production network.
 *
 * The hackathon production build targets BOT Chain Mainnet.
 * Testnet configuration is retained for reference and development.
 */
export const BOT_CHAIN = BOT_CHAIN_MAINNET;

export const INTENTSEAL_CONTRACT_ADDRESS =
  BOT_CHAIN.contractAddress;

export function isBotChain(
  chainId: bigint | number | string | null,
): boolean {
  if (chainId === null) {
    return false;
  }

  try {
    return (
      BigInt(chainId) ===
      BigInt(BOT_CHAIN.chainId)
    );
  } catch {
    return false;
  }
}

export function transactionExplorerUrl(
  transactionHash: string,
): string {
  return `${BOT_CHAIN.explorerUrl}/tx/${transactionHash}`;
}

export function contractExplorerUrl(): string {
  return `${BOT_CHAIN.explorerUrl}/address/${INTENTSEAL_CONTRACT_ADDRESS}`;
}