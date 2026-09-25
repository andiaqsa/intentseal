import { describe, expect, it } from "vitest";

import {
  BOT_CHAIN,
  BOT_CHAIN_MAINNET,
  BOT_CHAIN_TESTNET,
  INTENTSEAL_CONTRACT_ADDRESS,
  contractExplorerUrl,
  isBotChain,
  transactionExplorerUrl,
} from "./network";

describe("BOT Chain configuration", () => {
  it("uses BOT Chain Mainnet as the active production network", () => {
    expect(BOT_CHAIN).toBe(BOT_CHAIN_MAINNET);
    expect(BOT_CHAIN.chainId).toBe(677);
    expect(BOT_CHAIN.chainIdHex).toBe("0x2a5");
    expect(BOT_CHAIN.chainName).toBe("BOT Chain Mainnet");
    expect(BOT_CHAIN.rpcUrl).toBe("https://rpc.botchain.ai");
    expect(BOT_CHAIN.explorerUrl).toBe("https://scan.botchain.ai");
    expect(BOT_CHAIN.contractAddress).toBe(
      INTENTSEAL_CONTRACT_ADDRESS,
    );
  });

  it("retains BOT Chain Testnet metadata", () => {
    expect(BOT_CHAIN_TESTNET.chainId).toBe(968);
    expect(BOT_CHAIN_TESTNET.chainIdHex).toBe("0x3c8");
    expect(BOT_CHAIN_TESTNET.chainName).toBe("BOT Chain Testnet");
    expect(BOT_CHAIN_TESTNET.rpcUrl).toBe("https://rpc.bohr.life");
    expect(BOT_CHAIN_TESTNET.explorerUrl).toBe(
      "https://scan.bohr.life",
    );
  });

  it("recognizes decimal, numeric, bigint, and hexadecimal Mainnet chain IDs", () => {
    expect(isBotChain(677)).toBe(true);
    expect(isBotChain(677n)).toBe(true);
    expect(isBotChain("677")).toBe(true);
    expect(isBotChain("0x2a5")).toBe(true);

    expect(isBotChain(968)).toBe(false);
    expect(isBotChain("0x3c8")).toBe(false);
    expect(isBotChain("0x1")).toBe(false);
    expect(isBotChain(null)).toBe(false);
    expect(isBotChain("invalid")).toBe(false);
  });

  it("builds explorer links from centralized Mainnet values", () => {
    expect(transactionExplorerUrl("0xabc")).toBe(
      `${BOT_CHAIN.explorerUrl}/tx/0xabc`,
    );

    expect(contractExplorerUrl()).toBe(
      `${BOT_CHAIN.explorerUrl}/address/${INTENTSEAL_CONTRACT_ADDRESS}`,
    );
  });
});