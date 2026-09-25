# IntentSeal

> **Prove what was intended before the outcome existed.**

**IntentSeal** is a Proof-of-Prior-Intent DApp built on **BOT Chain**.

It allows someone to define and seal a goal **before work begins**, bind the finished result to one exact GitHub commit, review deterministic repository evidence, and seal the final outcome afterward.

The result is a verifiable chronology:

```text
BEFORE → EVIDENCE → AFTER
```

**Promise before. Evidence after. Proof forever.**

---

## 30-Second Overview

Most systems can show what exists now.

IntentSeal is designed to prove something different:

> **What was the original commitment before the result was already known?**

A user first defines a goal and measurable success criteria.

IntentSeal canonicalizes that intent, hashes it with `keccak256`, and records the hash on BOT Chain.

After the work is finished, the user attaches one exact GitHub commit. IntentSeal deterministically extracts repository evidence for each criterion.

The user reviews the evidence, generates the canonical outcome, and records its hash on BOT Chain.

Anyone can then inspect the chronology:

```text
Intent sealed at T1
        ↓
Work happens
        ↓
Exact GitHub commit
        ↓
Repository evidence
        ↓
Outcome sealed at T2
```

The original intent cannot simply be rewritten after seeing the final result without producing a different hash.

---

# Problem

After a project succeeds or fails, it is easy to rewrite the original promise.

For example:

- requirements can be edited,
- documents can be replaced,
- screenshots can be recreated,
- success criteria can be changed,
- project scope can be reinterpreted after the outcome is already known.

That creates a **goalpost-shifting / post-hoc rewriting problem**.

Imagine someone says after completing a project:

> “This was exactly what I planned to build.”

How can another person verify that those were actually the original goals?

A traditional application database is not enough because the application operator controls it.

---

# Solution

IntentSeal separates the process into two cryptographically committed moments.

## BEFORE

The user defines:

- a title,
- a goal,
- measurable success criteria.

IntentSeal converts that data into deterministic canonical JSON.

Example:

```json
{
  "schema": "intentseal.intent.v1",
  "title": "Add API rate limiting",
  "goal": "Implement login endpoint rate limiting before completing the task.",
  "criteria": [
    "Maximum 5 login attempts per minute per IP",
    "Return HTTP 429 when the limit is exceeded",
    "Add automated tests for rate limiting"
  ]
}
```

IntentSeal calculates:

```text
keccak256(canonicalIntent)
```

and records only the hash on BOT Chain through:

```solidity
createIntent(bytes32 intentHash)
```

The blockchain now proves that this commitment existed at **T1**.

---

## EVIDENCE

After the work is completed, the user provides:

```text
https://github.com/{owner}/{repository}
```

and optionally a branch, ref, or commit.

IntentSeal resolves that input into an exact immutable:

```text
40-character Git commit SHA
```

The Evidence Engine then:

1. retrieves the repository tree,
2. filters irrelevant/generated/binary files,
3. ranks relevant source and test files,
4. extracts bounded evidence snippets,
5. evaluates each original success criterion using transparent deterministic rules.

The evidence is tied to the exact commit, not merely a moving branch such as `main`.

---

## AFTER

The user reviews every criterion and its evidence.

IntentSeal generates a deterministic canonical outcome and calculates:

```text
keccak256(canonicalOutcome)
```

Only after explicit confirmation does the creator wallet call:

```solidity
completeIntent(
    uint256 intentId,
    bytes32 outcomeHash
)
```

The blockchain records the outcome at **T2**.

IntentSeal then reads the contract state back and verifies that the stored outcome hash exactly matches the locally calculated hash.

---

# Why BOT Chain?

Blockchain is not used in IntentSeal simply as storage.

It provides the trust layer for **chronology and integrity**.

The smart contract records:

- creator wallet,
- intent hash,
- intent timestamp,
- outcome hash,
- outcome timestamp,
- completion state.

A normal application database could theoretically be rewritten by its administrator.

BOT Chain allows the commitments and their ordering to be independently inspected.

The core proof is:

```text
T1: Intent committed
        ↓
Repository result exists
        ↓
T2: Outcome committed
```

IntentSeal therefore uses BOT Chain to answer:

> **Did this intent exist before the final outcome was recorded?**

---

# Why This Is Different

IntentSeal is not:

- an AI code reviewer,
- an AI scoring application,
- a GitHub analytics dashboard,
- a task manager,
- an NFT wrapper,
- or a database with blockchain added afterward.

Its primary abstraction is:

> **Proof of Prior Intent**

The system links:

```text
Original commitment
        +
Immutable blockchain timestamp
        +
Exact repository commit
        +
Criterion-level evidence
        +
Final outcome commitment
```

into one verifiable timeline.

---

# No AI Provider Required

IntentSeal's core flow requires **no AI provider**.

It does not require:

- OpenAI,
- Gemini,
- Groq,
- OpenRouter,
- Claude API,
- or another LLM service.

No AI API key is needed to use the main product.

The Evidence Engine is deterministic so that the most important user flow does not depend on:

- third-party AI availability,
- API quota,
- model changes,
- provider pricing,
- probabilistic model behavior.

This also makes evidence selection easier to explain and reproduce.

---

# Judge Quick Start

The main IntentSeal flow can be understood through five actions.

## 1. Connect

Connect MetaMask to the supported BOT Chain network.

## 2. Seal an Intent

Open **Create**.

Enter:

```text
Title
Goal
Success Criteria
```

Review:

```text
Canonical Intent
+
Intent Hash
```

Confirm the MetaMask transaction.

---

## 3. Attach Finished Work

Open **Evidence**.

Load the Intent ID.

Enter:

```text
Public GitHub repository
+
branch / ref / commit
```

IntentSeal resolves it to one exact Git commit SHA.

---

## 4. Review and Seal the Outcome

Review:

- each original criterion,
- matching file paths,
- line ranges,
- repository excerpts,
- evidence status.

Then explicitly confirm and seal the outcome.

---

## 5. Verify

Open **Verify**.

Inspect:

```text
BEFORE
Intent + T1

EVIDENCE
Exact Git commit
Criterion evidence

AFTER
Outcome + T2
```

---

# Main User Flow

```text
Create Intent
      ↓
Canonical JSON
      ↓
keccak256
      ↓
MetaMask
      ↓
createIntent()
      ↓
BOT Chain
      ↓
Intent ID / T1
      ↓
Build the work
      ↓
GitHub repository
      ↓
Exact commit SHA
      ↓
Deterministic evidence
      ↓
Human review
      ↓
Canonical Outcome
      ↓
keccak256
      ↓
MetaMask
      ↓
completeIntent()
      ↓
BOT Chain
      ↓
Outcome / T2
      ↓
Public Proof
```

---

# Architecture

```text
                           ┌────────────────────┐
                           │      React UI      │
                           └─────────┬──────────┘
                                     │
                 ┌───────────────────┴────────────────────┐
                 │                                        │
           BEFORE FLOW                              AFTER FLOW
                 │                                        │
         Structured Intent                         GitHub Repository
                 │                                        │
          Canonical JSON                             Resolve Ref
                 │                                        │
             keccak256                            Exact Commit SHA
                 │                                        │
          MetaMask Wallet                          Repository Tree
                 │                                        │
       createIntent(hash)                        Candidate Selection
                 │                                        │
            BOT Chain                           Evidence Extraction
                 │                                        │
                 │                         Deterministic Evaluation
                 │                                        │
                 │                               Human Review
                 │                                        │
                 │                             Canonical Outcome
                 │                                        │
                 │                                  keccak256
                 │                                        │
                 │                               MetaMask Wallet
                 │                                        │
                 └───────────────────── completeIntent() ──┘
                                              │
                                         BOT Chain
                                              │
                                         Public Proof
```

---

# Smart Contract

The core smart contract is:

```text
contracts/IntentSeal.sol
```

It is intentionally small and auditable.

## Core Functions

```solidity
createIntent(bytes32 intentHash)
```

Creates a new intent commitment.

```solidity
completeIntent(
    uint256 intentId,
    bytes32 outcomeHash
)
```

Records the final outcome hash.

```solidity
getIntent(uint256 intentId)
```

Returns the stored intent state.

```solidity
verifyIntent(
    uint256 intentId,
    bytes32 suppliedHash
)
```

Checks an intent hash.

```solidity
verifyOutcome(
    uint256 intentId,
    bytes32 suppliedHash
)
```

Checks an outcome hash.

```solidity
intentCount()
```

Returns the total number of intents.

---

# Contract Properties

The contract includes:

- monotonic intent IDs,
- zero-hash validation,
- creator ownership,
- creator-only outcome completion,
- one-time outcome recording,
- explicit intent existence checks,
- indexed events,
- immutable stored hashes,
- timestamped intent and outcome records,
- no inheritance,
- no external contract calls.

The intentionally limited contract surface makes the trust model easier to audit.

---

# Transaction Integrity

Frontend success is never assumed immediately after a wallet transaction.

For intent creation, the application checks:

```text
MetaMask transaction
→ receipt
→ IntentSealed event
→ intent ID
→ getIntent()
→ stored hash comparison
```

For outcome completion:

```text
MetaMask transaction
→ receipt
→ OutcomeSealed event
→ getIntent()
→ completed === true
→ stored outcomeHash === local outcomeHash
```

A success state is shown only after the expected blockchain readback matches.

---

# Deterministic Evidence Engine

IntentSeal accepts only public GitHub repository URLs matching:

```text
https://github.com/{owner}/{repository}
```

The backend does not accept arbitrary fetch destinations.

The pipeline is:

```text
GitHub URL
   ↓
Validate repository
   ↓
Resolve branch/ref
   ↓
Lock full commit SHA
   ↓
Retrieve tree
   ↓
Select candidate files
   ↓
Extract bounded snippets
   ↓
Criterion matching
   ↓
Outcome Draft
```

---

# Exact Commit Locking

A branch such as:

```text
main
```

can move.

Therefore IntentSeal resolves the requested ref into a specific:

```text
40-character Git commit SHA
```

before evaluation.

The final outcome references that exact commit.

This means the repository evidence cannot silently change because new commits are later pushed to the branch.

---

# Repository Safety Limits

Repository processing is bounded.

The engine limits:

- tree entries,
- candidate files,
- individual file size,
- combined source text,
- extracted snippets,
- request duration.

It excludes typical irrelevant or generated content such as:

```text
node_modules
vendor
dist
build
coverage
binary files
images
archives
```

This keeps evidence collection predictable and prevents unrestricted repository processing.

---

# Criterion Evaluation

The deterministic evaluator can use signals such as:

- exact phrases,
- source identifiers,
- numeric values,
- HTTP status codes,
- relevant filenames,
- test/spec filenames,
- test functions,
- configuration values,
- rate-limit terminology,
- time windows,
- per-IP handling.

Example criterion:

```text
Return HTTP 429 when the limit is exceeded
```

Strong evidence may include:

```text
429
status(429)
Too Many Requests
rateLimit
rate limit
```

Example criterion:

```text
Add automated tests for rate limiting
```

Relevant signals may include:

```text
.test
.spec
describe(
it(
test(
expect(
rateLimit
429
```

---

# Evidence Status Semantics

IntentSeal uses three evidence-coverage states.

## SATISFIED

Strong deterministic repository evidence matching the criterion was found.

This does **not** mean the entire software system has been formally proven correct.

---

## PARTIAL

Relevant repository evidence exists, but the deterministic evidence rules cannot establish all required signals.

---

## NOT_FOUND

No sufficient matching repository evidence was found.

---

IntentSeal intentionally avoids:

```text
AI confidence scores
percentage correctness
arbitrary 1–10 ratings
probabilistic quality claims
```

---

# Deterministic Explanations

Evidence explanations are produced from known repository signals.

Example:

```text
Strong matching evidence was found in
src/middleware/rateLimit.ts, lines 42–48.

The selected source contains HTTP status 429
and rate-limit handling.
```

Another example:

```text
Some rate-limit implementation evidence was found,
but the repository evidence does not clearly establish
the exact maximum of five attempts per minute per IP.
```

The system does not pretend deterministic matching has unlimited semantic understanding.

---

# Human Review Is Part of the Trust Model

The Evidence Engine proposes evidence.

The user reviews it.

Before blockchain completion, IntentSeal explicitly shows:

```text
DRAFT — NOT YET SEALED
```

The final outcome is therefore a **reviewed claim backed by deterministic repository evidence**, not an autonomous model judgment.

Only after explicit confirmation is the outcome hash submitted on-chain.

---

# Canonical Intent

IntentSeal uses:

```json
{
  "schema": "intentseal.intent.v1",
  "title": "...",
  "goal": "...",
  "criteria": [
    "..."
  ]
}
```

Canonicalization uses:

- fixed key ordering,
- normalized line endings,
- trimmed values,
- preserved criterion ordering.

Hash:

```text
keccak256(UTF-8 canonical intent)
```

Changing the canonical payload changes the hash.

---

# Canonical Outcome

The outcome uses:

```text
intentseal.outcome.v1
```

It binds information such as:

- intent ID,
- repository identity,
- exact commit SHA,
- commit URL,
- ordered criterion evaluations,
- selected evidence.

Hash:

```text
keccak256(UTF-8 canonical outcome)
```

Meaningful modifications such as changing:

- commit,
- status,
- evidence path,
- evidence lines,
- excerpt,
- criterion evidence,

produce a different outcome hash.

---

# Public Proof

The Verify experience is designed around three phases:

```text
┌─────────────────────┐
│       BEFORE        │
│                     │
│ Intent              │
│ Creator             │
│ Intent Hash         │
│ Timestamp T1        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│      EVIDENCE       │
│                     │
│ Repository          │
│ Exact Commit SHA    │
│ Criteria            │
│ Files / Lines       │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│        AFTER        │
│                     │
│ Outcome Hash        │
│ Timestamp T2        │
│ Completion State    │
└─────────────────────┘
```

The integrity checks can establish:

```text
✓ Intent hash matches BOT Chain
✓ Outcome hash matches BOT Chain
✓ Exact Git commit is locked
✓ Creator identity is preserved
✓ Intent predates the recorded outcome
```

---

# Trust Model

IntentSeal separates responsibilities.

## BOT Chain

BOT Chain establishes:

- creator identity,
- intent hash,
- intent timestamp,
- outcome hash,
- outcome timestamp,
- completion state.

---

## GitHub

GitHub provides:

- repository identity,
- exact commit SHA,
- immutable commit URL,
- source evidence.

---

## IntentSeal Evidence Engine

The engine deterministically:

- selects bounded repository data,
- finds criterion-relevant evidence,
- generates transparent evidence coverage states.

---

## User

The user:

- defines the intent,
- reviews canonical content,
- approves wallet transactions,
- reviews evidence,
- confirms the outcome.

---

# What IntentSeal Proves

IntentSeal can establish that:

- an intent hash existed at time `T1`,
- the intent was associated with a specific creator wallet,
- the original intent hash has not changed,
- an outcome hash was recorded later at `T2`,
- the same creator recorded the outcome,
- the reviewed outcome references one exact GitHub commit,
- canonical content available to the verifier matches the corresponding blockchain hashes,
- the recorded intent existed before the recorded outcome.

---

# What IntentSeal Does NOT Prove

IntentSeal does not claim that:

- software is bug-free,
- code is formally verified,
- every criterion is objectively true,
- repository evidence guarantees runtime behavior,
- blockchain data proves absolute software correctness.

Its scope is:

```text
Chronology
Integrity
Provenance
```

This distinction is intentional.

---

# Golden Demo Scenario

The primary demonstration uses:

```text
Title:
Add API rate limiting

Goal:
Implement login endpoint rate limiting before completing the task.

Criteria:
1. Maximum 5 login attempts per minute per IP
2. Return HTTP 429 when the limit is exceeded
3. Add automated tests for rate limiting
```

The expected story is:

```text
Intent defined
    ↓
Intent sealed
    ↓
Implementation completed
    ↓
Exact Git commit locked
    ↓
Evidence found for criteria
    ↓
Human review
    ↓
Outcome sealed
    ↓
Public proof
```

---

# BOT Chain Deployment

IntentSeal is deployed on **BOT Chain Testnet** and **BOT Chain Mainnet**.

## BOT Chain Testnet

| Field | Value |
|---|---|
| Network | BOT Chain Testnet |
| Chain ID | `968` |
| Native Token | `BOT` |
| Solidity | `0.8.20` |
| EVM Target | `Paris` |
| Optimizer | Disabled |
| Contract | `0x5F776464dFFFBb0699eF6395f8D2B6088A617c1A` |
| Explorer | `https://scan.bohr.life/address/0x5F776464dFFFBb0699eF6395f8D2B6088A617c1A` |

---

## BOT Chain Mainnet

| Field | Value |
|---|---|
| Network | BOT Chain Mainnet |
| Chain ID | `677` |
| Native Token | `BOT` |
| Solidity | `0.8.20` |
| EVM Target | `Paris` |
| Optimizer | Disabled |
| Contract | `0xE11B90f99876e020cAA17a76F09CF29feE0F5656` |
| Deployment Transaction | `0xd560747fc6cdf37ac01ae672a20ee20b14256296beab77746551564e1f741922` |
| Deployment Block | `24486746` |
| Deployer | `0xa91c184BEcDe78dD6783a5708bDdDa8dF676b6B0` |
| Status | `Finalized` |
| Explorer | `https://scan.botchain.ai/address/0xE11B90f99876e020cAA17a76F09CF29feE0F5656` |

Deployment transaction:

```text
https://scan.botchain.ai/tx/0xd560747fc6cdf37ac01ae672a20ee20b14256296beab77746551564e1f741922
```

Additional deployment records are available in:

```text
docs/deployment.md
docs/MAINNET_CHECKLIST.md
```

---

# Network Reference

| Configuration | Testnet | Mainnet |
|---|---|---|
| Chain ID | `968` | `677` |
| RPC | `https://rpc.bohr.life` | `https://rpc.botchain.ai` |
| Native Token | `BOT` | `BOT` |
| Explorer | `https://scan.bohr.life` | `https://scan.botchain.ai` |

---

# Live Application

```text
[ADD FINAL LIVE URL]
```

The production application should be tested through a fresh browser session before submission.

Primary routes include:

```text
Create
Evidence
Verify
```

---

# Run Locally

## Requirements

- Node.js 20+
- npm
- MetaMask

Clone the repository:

```bash
git clone [YOUR_PUBLIC_REPOSITORY_URL]
cd intentseal
```

Install dependencies:

```bash
npm install
```

Create the local environment file.

### Windows

```bash
copy .env.example .env.local
```

### macOS / Linux

```bash
cp .env.example .env.local
```

Start the server:

```bash
npm run dev:server
```

Start the frontend in another terminal:

```bash
npm run dev
```

The local Evidence Engine runs at:

```text
http://127.0.0.1:8787
```

Vite proxies the relevant development API requests.

---

# Environment Variables

No AI API credential is required.

Example:

```dotenv
# Optional server-side GitHub authentication for higher API limits.
GITHUB_TOKEN=

# Bounded Evidence Engine timeout.
EVIDENCE_TIMEOUT_MS=60000
```

`GITHUB_TOKEN` is optional for public repositories but recommended for deployment reliability.

Server secrets must never be exposed using:

```text
VITE_
```

variables.

---

# Testing

Run:

```bash
npm run build
npm run lint
npm run test:frontend
npm run test:server
npm test
npm audit --omit=dev
git diff --check
```

The test suites cover major areas including:

- canonical intent serialization,
- intent hashing,
- wallet connection,
- BOT Chain network handling,
- intent creation,
- event parsing,
- on-chain readback,
- GitHub validation,
- commit locking,
- repository evidence extraction,
- deterministic evidence evaluation,
- canonical outcome hashing,
- explicit outcome confirmation,
- `completeIntent`,
- `OutcomeSealed`,
- outcome readback,
- final verification,
- Solidity contract behavior.

---

# Security

IntentSeal uses a deliberately constrained security model.

## Wallet

- no private key handling,
- no seed phrase handling,
- all blockchain writes require explicit MetaMask approval.

## GitHub

- public repositories only,
- strict `github.com` URL validation,
- no arbitrary backend URL fetching,
- bounded API requests,
- bounded repository size,
- bounded file processing,
- server-side token only.

## Blockchain

- exact hash comparison,
- creator-only completion,
- one-time outcome sealing,
- transaction event validation,
- post-transaction contract readback.

## Frontend

- no raw HTML injection,
- no AI-generated HTML,
- no server secrets in client variables,
- explicit error states,
- success shown only after verification.

---

# Reliability Philosophy

IntentSeal intentionally prioritizes:

```text
One complete proof flow
over
many fragile features
```

The critical path does not depend on an external AI provider.

If a third-party AI service is unavailable, IntentSeal's proof workflow remains unaffected.

---

# Mainnet Launch

**IntentSeal is deployed on BOT Chain Mainnet.**

Mainnet contract:

```text
0xE11B90f99876e020cAA17a76F09CF29feE0F5656
```

Chain ID:

```text
677
```

Deployment block:

```text
24486746
```

Deployment transaction:

```text
0xd560747fc6cdf37ac01ae672a20ee20b14256296beab77746551564e1f741922
```

---

# Hackathon Submission Resources

Supporting material:

- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)
- [`docs/X_POST_DRAFT.md`](docs/X_POST_DRAFT.md)
- [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md)
- [`docs/GOLDEN_DEMO_REPOSITORY.md`](docs/GOLDEN_DEMO_REPOSITORY.md)
- [`docs/MAINNET_CHECKLIST.md`](docs/MAINNET_CHECKLIST.md)
- [`docs/deployment.md`](docs/deployment.md)

---

# Submission Links

Fill these before final submission.

## Live Website

```text
[ADD LIVE URL]
```

## GitHub Repository

```text
[ADD PUBLIC GITHUB URL]
```

## Project X Account

```text
https://x.com/qsa_project23
```

## X Submission Post

```text
[ADD FINAL X POST URL]
```

## Mainnet Launch Announcement

```text
[ADD MAINNET LAUNCH ANNOUNCEMENT URL]
```

---

# Built on BOT Chain

IntentSeal is built on **BOT Chain**.

BOT Chain:

```text
https://botchain.ai
```

Mainnet Explorer:

```text
https://scan.botchain.ai
```

Testnet Explorer:

```text
https://scan.bohr.life
```

---

# Project Principle

> **Promise before. Evidence after. Proof forever.**