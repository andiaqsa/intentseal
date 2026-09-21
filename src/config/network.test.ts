import { describe, expect, it } from "vitest";

import {
  BOT_CHAIN,
  INTENTSEAL_CONTRACT_ADDRESS,
  contractExplorerUrl,
  isBotChain,
  transactionExplorerUrl,
} from "./network";

describe("BOT Chain configuration", () => {
  it("recognizes decimal, numeric, bigint, and hexadecimal chain IDs", () => {
    expect(isBotChain(968)).toBe(true);
    expect(isBotChain(968n)).toBe(true);
    expect(isBotChain("968")).toBe(true);
    expect(isBotChain("0x3c8")).toBe(true);
    expect(isBotChain("0x1")).toBe(false);
    expect(isBotChain(null)).toBe(false);
  });

  it("builds explorer links from centralized values", () => {
    expect(transactionExplorerUrl("0xabc")).toBe(`${BOT_CHAIN.explorerUrl}/tx/0xabc`);
    expect(contractExplorerUrl()).toBe(
      `${BOT_CHAIN.explorerUrl}/address/${INTENTSEAL_CONTRACT_ADDRESS}`,
    );
  });
});
