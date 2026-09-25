# IntentSeal

IntentSeal proves what was intended before the outcome existed.

Seal a goal before work begins, bind the result to one exact GitHub commit, review deterministic evidence, and record the final outcome hash on BOT Chain.

## Problem

After a project succeeds or fails, it is easy to rewrite the original promise. Screenshots and edited documents do not prove what existed first.

## Solution

IntentSeal creates a verifiable `BEFORE → EVIDENCE → AFTER` record:

1. Define a goal and measurable success criteria.
2. Review deterministic canonical JSON and its keccak256 hash.
3. Seal the intent hash on BOT Chain.
4. Lock completed work to an exact public GitHub commit SHA.
5. Review criterion-level evidence produced by transparent rules.
6. Seal the reviewed outcome hash and verify the chronology publicly.

## Why blockchain

The contract supplies the shared timestamp, creator identity, and immutable intent/outcome hashes. A normal database administrator could rewrite those facts. BOT Chain makes the order of the two commitments independently readable.

## Demo flow

- Open **Create**, enter the golden rate-limit intent, review the canonical payload, connect MetaMask, and seal it.
- Open **Evidence**, load the intent ID, enter a public GitHub repository and ref, then review the exact commit and evidence.
- Confirm every criterion and seal the outcome with the creator wallet.
- Open **Verify** to show the complete T1 → commit → T2 proof.

No AI key or AI provider is used anywhere in this flow.

## Architecture

```text
React + MetaMask
  ├─ canonical intent → keccak256 → IntentSeal.createIntent
  ├─ public GitHub URL → server allow-list + bounded GitHub API collection
  ├─ deterministic evidence rules → canonical outcome → keccak256
  ├─ IntentSeal.completeIntent → event + readback verification
  └─ public proof → direct BOT Chain read + locally retained canonical data
```

Only hashes and essential metadata are stored on-chain. Canonical content remains browser-local in the current hackathon build; losing browser storage does not invalidate the on-chain hash, but the full local proof content must be exported/published separately for portable public sharing.

## Smart contract

The frozen `IntentSeal.sol` contract supports:

- `createIntent(bytes32 intentHash)`
- `completeIntent(uint256 intentId, bytes32 outcomeHash)`
- `getIntent(uint256 intentId)`
- `verifyIntent(...)` and `verifyOutcome(...)`

Frontend success is shown only after the expected event is parsed and `getIntent` readback matches the locally calculated hash.

## Evidence Engine

The server accepts only public `https://github.com/{owner}/{repo}` repository URLs. It resolves a ref to a full 40-character commit SHA, applies strict tree/file/byte limits, excludes binary/generated paths, and extracts bounded snippets in deterministic order.

Each criterion is matched using explainable signals: exact terms, identifiers, numeric values, HTTP statuses, rate-limit symbols, test filenames and test functions, time-window configuration, and per-IP handling. Results mean:

- `SATISFIED`: strong deterministic repository evidence was found.
- `PARTIAL`: relevant evidence exists, but required signals are incomplete.
- `NOT_FOUND`: no sufficient matching evidence was found.

These labels are evidence-coverage statements, not probabilities or claims of formal correctness.

## Trust model

The Evidence Engine proposes evidence; the user reviews it. Outcome sealing requires an explicit confirmation, the original creator wallet, BOT Chain Testnet, a confirmed `OutcomeSealed` event, and matching contract readback.

### What IntentSeal proves

- The intent hash existed at T1.
- The same creator later recorded an outcome hash at T2.
- The reviewed outcome binds an exact GitHub commit and selected evidence.
- The canonical content shown locally matches the on-chain hashes.

### What IntentSeal does not prove

IntentSeal does not prove that software is absolutely correct. BOT Chain proves chronology and integrity; repository evidence establishes provenance for human review.

## BOT Chain deployment

| Network | Chain ID | Contract |
|---|---:|---|
| BOT Chain Testnet | 968 | [`0x5F776464dFFFBb0699eF6395f8D2B6088A617c1A`](https://scan.bohr.life/address/0x5F776464dFFFBb0699eF6395f8D2B6088A617c1A) |
| BOT Chain Mainnet | 677 | Not deployed / not configured |

Historical testnet deployment evidence is in [`docs/deployment.md`](docs/deployment.md). Mainnet steps are in [`docs/MAINNET_CHECKLIST.md`](docs/MAINNET_CHECKLIST.md).

## Run locally

Requirements: Node.js 20+ and MetaMask.

```bash
npm install
copy .env.example .env.local
npm run dev:server
npm run dev
```

The UI runs through Vite and the local evidence endpoint runs at `127.0.0.1:8787`. Configure the Vite dev proxy as already defined in `vite.config.ts`.

## Environment variables

```dotenv
# Optional server-side token for higher public GitHub API limits
GITHUB_TOKEN=

# Optional, bounded to 5,000–60,000 ms
EVIDENCE_TIMEOUT_MS=30000
```

No OpenAI, Gemini, Groq, OpenRouter, or other LLM credential is required. Never expose server tokens through a `VITE_` variable.

## Testing

```bash
npm run build
npm run lint
npm run test:frontend
npm run test:server
npm test
npm audit --omit=dev
git diff --check
```

## Security

- No private key or seed phrase handling.
- GitHub token remains server-side and is optional.
- Strict GitHub host/URL allow-list; no arbitrary server fetch target.
- Public repositories only, with bounded requests, tree size, files, bytes, and timeouts.
- Deterministic commit locking and canonical hashing.
- Sanitized production errors; no stack traces or secret dumps.
- No raw HTML injection.

## Submission resources

- [60–90 second demo script](docs/DEMO_SCRIPT.md)
- [X post draft](docs/X_POST_DRAFT.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)
- [Golden demo repository guide](docs/GOLDEN_DEMO_REPOSITORY.md)

Submission links (manual completion required):

- Live website: `[ADD LIVE URL]`
- GitHub repository: `[ADD PUBLIC REPOSITORY URL]`
- X project account/post: `[ADD X URL]`

Built on BOT Chain. Learn more at [botchain.ai](https://botchain.ai).
