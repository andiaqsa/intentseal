# IntentSeal

IntentSeal records a timestamped, immutable hash of an intent before its outcome exists. The Phase 3 frontend creates a deterministic canonical payload, previews its exact hash, and seals that hash through MetaMask on BOT Chain Testnet.

## Run locally

```bash
npm install
npm run dev
```

The application uses the deployed `IntentSeal` contract at `0x5F776464dFFFBb0699eF6395f8D2B6088A617c1A` on BOT Chain Testnet (chain ID `968`). No private key or environment variable is required. Write operations are signed directly in MetaMask.

## Quality checks

```bash
npm run build
npm run lint
npm run test:frontend
npm test
```

- `npm run test:frontend` covers canonical serialization, hash determinism, and network helpers.
- `npm test` runs the existing Hardhat contract suite.

The full canonical intent is kept as clearly labeled local application data after confirmation. Only its `bytes32` keccak256 hash is stored on-chain.
