import { expect } from "chai";
import { ZeroHash, id } from "ethers";
import hre from "hardhat";

const { ethers } = await hre.network.create();

const INTENT_HASH = id("intentseal:test:intent:one");
const SECOND_INTENT_HASH = id("intentseal:test:intent:two");
const OUTCOME_HASH = id("intentseal:test:outcome:one");
const SECOND_OUTCOME_HASH = id("intentseal:test:outcome:two");
const INCORRECT_HASH = id("intentseal:test:incorrect");

async function deployIntentSeal() {
  const [creator, other] = await ethers.getSigners();
  const intentSeal = await ethers.deployContract("IntentSeal");
  await intentSeal.waitForDeployment();

  return { intentSeal, creator, other };
}

describe("IntentSeal", function () {
  describe("Initial state", function () {
    it("starts with an intent count of zero", async function () {
      const { intentSeal } = await deployIntentSeal();

      expect(await intentSeal.intentCount()).to.equal(0n);
    });
  });

  describe("Create intent", function () {
    it("creates intent ID 1 with the expected initial data", async function () {
      const { intentSeal, creator } = await deployIntentSeal();

      expect(await intentSeal.createIntent.staticCall(INTENT_HASH)).to.equal(1n);
      await intentSeal.createIntent(INTENT_HASH);

      const storedIntent = await intentSeal.getIntent(1n);
      expect(await intentSeal.intentCount()).to.equal(1n);
      expect(storedIntent.creator).to.equal(creator.address);
      expect(storedIntent.intentHash).to.equal(INTENT_HASH);
      expect(storedIntent.outcomeHash).to.equal(ZeroHash);
      expect(storedIntent.createdAt).to.be.greaterThan(0n);
      expect(storedIntent.completedAt).to.equal(0n);
      expect(storedIntent.completed).to.equal(false);
    });

    it("emits IntentSealed with the correct indexed values", async function () {
      const { intentSeal, creator } = await deployIntentSeal();

      const transaction = await intentSeal.createIntent(INTENT_HASH);
      const receipt = await transaction.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(transaction)
        .to.emit(intentSeal, "IntentSealed")
        .withArgs(1n, creator.address, INTENT_HASH, BigInt(block!.timestamp));
    });
  });

  describe("Invalid creation", function () {
    it("reverts with InvalidHash for a zero intent hash", async function () {
      const { intentSeal } = await deployIntentSeal();

      await expect(intentSeal.createIntent(ZeroHash)).to.be.revertedWithCustomError(
        intentSeal,
        "InvalidHash",
      );
    });
  });

  describe("Multiple intents", function () {
    it("assigns monotonically increasing intent IDs", async function () {
      const { intentSeal } = await deployIntentSeal();

      await intentSeal.createIntent(INTENT_HASH);
      await intentSeal.createIntent(SECOND_INTENT_HASH);

      expect(await intentSeal.intentCount()).to.equal(2n);
      expect((await intentSeal.getIntent(1n)).intentHash).to.equal(INTENT_HASH);
      expect((await intentSeal.getIntent(2n)).intentHash).to.equal(SECOND_INTENT_HASH);
    });

    it("allows duplicate intent hashes under distinct IDs", async function () {
      const { intentSeal } = await deployIntentSeal();

      await intentSeal.createIntent(INTENT_HASH);
      await intentSeal.createIntent(INTENT_HASH);

      expect((await intentSeal.getIntent(1n)).intentHash).to.equal(INTENT_HASH);
      expect((await intentSeal.getIntent(2n)).intentHash).to.equal(INTENT_HASH);
    });

    it("retains the correct creator for intents from different signers", async function () {
      const { intentSeal, creator, other } = await deployIntentSeal();

      await intentSeal.createIntent(INTENT_HASH);
      await (intentSeal.connect(other) as typeof intentSeal).createIntent(SECOND_INTENT_HASH);

      expect((await intentSeal.getIntent(1n)).creator).to.equal(creator.address);
      expect((await intentSeal.getIntent(2n)).creator).to.equal(other.address);
    });
  });

  describe("Get intent", function () {
    it("returns all stored data for an existing intent", async function () {
      const { intentSeal, creator } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);

      const storedIntent = await intentSeal.getIntent(1n);

      expect(storedIntent.creator).to.equal(creator.address);
      expect(storedIntent.intentHash).to.equal(INTENT_HASH);
      expect(storedIntent.outcomeHash).to.equal(ZeroHash);
      expect(storedIntent.createdAt).to.be.greaterThan(0n);
      expect(storedIntent.completedAt).to.equal(0n);
      expect(storedIntent.completed).to.equal(false);
    });

    it("reverts with IntentNotFound for a nonexistent ID", async function () {
      const { intentSeal } = await deployIntentSeal();

      await expect(intentSeal.getIntent(999n)).to.be.revertedWithCustomError(
        intentSeal,
        "IntentNotFound",
      );
    });

    it("reverts with IntentNotFound for ID zero", async function () {
      const { intentSeal } = await deployIntentSeal();

      await expect(intentSeal.getIntent(0n)).to.be.revertedWithCustomError(
        intentSeal,
        "IntentNotFound",
      );
    });
  });

  describe("Complete intent", function () {
    it("allows the creator to store an outcome and mark the intent complete", async function () {
      const { intentSeal } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);

      await intentSeal.completeIntent(1n, OUTCOME_HASH);
      const storedIntent = await intentSeal.getIntent(1n);

      expect(storedIntent.outcomeHash).to.equal(OUTCOME_HASH);
      expect(storedIntent.completedAt).to.be.greaterThan(0n);
      expect(storedIntent.completed).to.equal(true);
    });

    it("emits OutcomeSealed with the correct intent ID and outcome hash", async function () {
      const { intentSeal } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);

      const transaction = await intentSeal.completeIntent(1n, OUTCOME_HASH);
      const receipt = await transaction.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(transaction)
        .to.emit(intentSeal, "OutcomeSealed")
        .withArgs(1n, OUTCOME_HASH, BigInt(block!.timestamp));
    });
  });

  describe("Authorization", function () {
    it("reverts with NotIntentCreator when another wallet completes the intent", async function () {
      const { intentSeal, other } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);

      await expect(
        (intentSeal.connect(other) as typeof intentSeal).completeIntent(1n, OUTCOME_HASH),
      ).to.be.revertedWithCustomError(intentSeal, "NotIntentCreator");
    });
  });

  describe("Invalid outcome", function () {
    it("reverts with InvalidHash for a zero outcome hash", async function () {
      const { intentSeal } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);

      await expect(intentSeal.completeIntent(1n, ZeroHash)).to.be.revertedWithCustomError(
        intentSeal,
        "InvalidHash",
      );
    });

    it("reverts with IntentNotFound when completing a nonexistent intent", async function () {
      const { intentSeal } = await deployIntentSeal();

      await expect(
        intentSeal.completeIntent(999n, OUTCOME_HASH),
      ).to.be.revertedWithCustomError(intentSeal, "IntentNotFound");
    });
  });

  describe("One-time completion", function () {
    it("rejects a second completion and preserves the original outcome hash", async function () {
      const { intentSeal } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);
      await intentSeal.completeIntent(1n, OUTCOME_HASH);

      await expect(
        intentSeal.completeIntent(1n, SECOND_OUTCOME_HASH),
      ).to.be.revertedWithCustomError(intentSeal, "IntentAlreadyCompleted");

      expect((await intentSeal.getIntent(1n)).outcomeHash).to.equal(OUTCOME_HASH);
    });
  });

  describe("Verify intent", function () {
    it("returns true for the correct intent hash", async function () {
      const { intentSeal } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);

      expect(await intentSeal.verifyIntent(1n, INTENT_HASH)).to.equal(true);
    });

    it("returns false for an incorrect intent hash", async function () {
      const { intentSeal } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);

      expect(await intentSeal.verifyIntent(1n, INCORRECT_HASH)).to.equal(false);
    });

    it("reverts with IntentNotFound for a nonexistent ID", async function () {
      const { intentSeal } = await deployIntentSeal();

      await expect(intentSeal.verifyIntent(999n, INTENT_HASH)).to.be.revertedWithCustomError(
        intentSeal,
        "IntentNotFound",
      );
    });
  });

  describe("Verify outcome", function () {
    it("returns true for the correct outcome hash after completion", async function () {
      const { intentSeal } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);
      await intentSeal.completeIntent(1n, OUTCOME_HASH);

      expect(await intentSeal.verifyOutcome(1n, OUTCOME_HASH)).to.equal(true);
    });

    it("returns false for an incorrect outcome hash after completion", async function () {
      const { intentSeal } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);
      await intentSeal.completeIntent(1n, OUTCOME_HASH);

      expect(await intentSeal.verifyOutcome(1n, INCORRECT_HASH)).to.equal(false);
    });

    it("reverts with IntentNotCompleted before completion", async function () {
      const { intentSeal } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);

      await expect(intentSeal.verifyOutcome(1n, OUTCOME_HASH)).to.be.revertedWithCustomError(
        intentSeal,
        "IntentNotCompleted",
      );
    });

    it("reverts with IntentNotFound for a nonexistent ID", async function () {
      const { intentSeal } = await deployIntentSeal();

      await expect(intentSeal.verifyOutcome(999n, OUTCOME_HASH)).to.be.revertedWithCustomError(
        intentSeal,
        "IntentNotFound",
      );
    });
  });

  describe("Isolation", function () {
    it("completing one intent does not mutate another intent", async function () {
      const { intentSeal, other } = await deployIntentSeal();
      await intentSeal.createIntent(INTENT_HASH);
      await (intentSeal.connect(other) as typeof intentSeal).createIntent(SECOND_INTENT_HASH);

      const secondBefore = await intentSeal.getIntent(2n);
      await intentSeal.completeIntent(1n, OUTCOME_HASH);
      const firstAfter = await intentSeal.getIntent(1n);
      const secondAfter = await intentSeal.getIntent(2n);

      expect(firstAfter.completed).to.equal(true);
      expect(firstAfter.outcomeHash).to.equal(OUTCOME_HASH);
      expect(secondAfter.creator).to.equal(secondBefore.creator);
      expect(secondAfter.intentHash).to.equal(secondBefore.intentHash);
      expect(secondAfter.outcomeHash).to.equal(ZeroHash);
      expect(secondAfter.createdAt).to.equal(secondBefore.createdAt);
      expect(secondAfter.completedAt).to.equal(0n);
      expect(secondAfter.completed).to.equal(false);
      expect(await intentSeal.intentCount()).to.equal(2n);
    });
  });
});
