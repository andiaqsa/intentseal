# IntentSeal

IntentSeal creates timestamped proof of an intent before its outcome exists. A user can describe an intent in rough language, optionally use AI to turn it into a clearer draft, edit every field, review the exact canonical payload, and seal only its keccak256 hash on BOT Chain Testnet.

AI is advisory: it never hashes, signs, or submits an intent. The user controls the final wording, and the manual flow remains available when AI is unavailable or not configured.

## Current architecture

```text
rough intent
  -> POST /api/intent/structure (server-side AI adapter)
  -> editable title, goal, and criteria
  -> canonical payload review
  -> keccak256 hash
  -> explicit user confirmation and MetaMask signature
  -> IntentSeal contract on BOT Chain Testnet
```

The browser never receives an AI credential. The production endpoint is a minimal Vercel Function in `api/intent/structure.ts`; local development uses the same route logic through a small Node server. OpenAI and Gemini are implemented behind `IntentStructuringProvider`, so frontend and application logic do not depend on the selected provider.

The canonical schema remains `intentseal.intent.v1`. No AI metadata enters the canonical payload. Only the `bytes32` hash is stored on-chain; the full approved intent remains off-chain in local browser storage in this MVP.

## Local development

Requirements: Node.js with npm, a MetaMask-compatible browser, and two terminals.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`, select one provider, and replace only that provider's API-key placeholder. Keep this file local and never prefix a secret with `VITE_`.

   Gemini Developer API through Google AI Studio:

   ```dotenv
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_server_side_google_ai_studio_key
   AI_MODEL=gemini-3-flash-preview
   AI_TIMEOUT_MS=30000
   ```

   Or OpenAI:

   ```dotenv
   AI_PROVIDER=openai
   AI_API_KEY=your_server_side_openai_key
   AI_MODEL=gpt-4o-mini
   AI_TIMEOUT_MS=15000
   ```

   Gemini API access is configured through Google AI Studio. A Google AI subscription by itself is not an API credential. Gemini mode does not require `AI_API_KEY`, and OpenAI mode does not require `GEMINI_API_KEY`.

3. Start the local AI API in terminal one:

   ```bash
   npm run dev:server
   ```

4. Start Vite in terminal two:

   ```bash
   npm run dev
   ```

5. Open the URL printed by Vite, normally `http://localhost:5173`. Vite proxies `/api` to the local server on `127.0.0.1:8787`.

`AI_PROVIDER` accepts `gemini` or `openai`. `GEMINI_API_KEY` is required only for Gemini; `AI_API_KEY` is required only for OpenAI. `AI_MODEL` selects the provider model and defaults to `gemini-3-flash-preview` in Gemini mode. `AI_TIMEOUT_MS` is optional and constrained to 1–30 seconds, with a 15-second application default. The browser uses a separate 40-second infrastructure safety deadline, which must remain greater than the maximum 30-second server/provider timeout so the server remains authoritative.

To use IntentSeal without AI, the API process and AI environment variables are not required. Select **Write manually** and continue through the existing title, goal, criteria, canonical review, and sealing flow.

## Network and contract

The application uses the deployed `IntentSeal` contract at `0x5F776464dFFFBb0699eF6395f8D2B6088A617c1A` on BOT Chain Testnet (chain ID `968`). Write operations are signed directly in MetaMask; no wallet private key, mnemonic, or seed phrase is used by the application.

## Quality checks

```bash
npm run build
npm run lint
npm run test:frontend
npm run test:server
npm test
npm audit --omit=dev
git diff --check
```

- `npm run test:frontend` covers the AI/manual UI paths, canonical serialization, hash determinism, wallet behavior, and verification UI.
- `npm run test:server` uses provider test doubles; it never makes paid AI calls.
- `npm test` runs the existing Hardhat contract suite.

## Current scope

This phase structures drafts only. GitHub evidence analysis, automated outcome evaluation, outcome sealing, public proof pages, accounts, and a cloud database are not implemented yet.

For production, add infrastructure-level rate limiting and request observability without logging intent contents or secrets. Keep provider credentials in the deployment platform's server-side secret store.
