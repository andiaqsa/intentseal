import { getAddress } from "ethers";

export const BOT_CHAIN = Object.freeze({
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
});

export const INTENTSEAL_CONTRACT_ADDRESS = getAddress(
  "0x5F776464dFFFBb0699eF6395f8D2B6088A617c1A",
);

export function isBotChain(chainId: bigint | number | string | null): boolean {
  if (chainId === null) return false;

  try {
    return BigInt(chainId) === BigInt(BOT_CHAIN.chainId);
  } catch {
    return false;
  }
}

export function transactionExplorerUrl(transactionHash: string): string {
  return `${BOT_CHAIN.explorerUrl}/tx/${transactionHash}`;
}

export function contractExplorerUrl(): string {
  return `${BOT_CHAIN.explorerUrl}/address/${INTENTSEAL_CONTRACT_ADDRESS}`;
}
