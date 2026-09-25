# BOT Chain Mainnet Checklist

Mainnet is configured at the network-metadata level only. No mainnet IntentSeal address is present and no transaction should be sent until the organizer supplies BOT and the deployment is explicitly approved.

- [ ] Obtain the required BOT allocation.
- [ ] Add BOT Chain Mainnet (chain ID `677`, RPC `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`) to the deployment wallet.
- [ ] Confirm the deployment wallet and protect its key outside the repository.
- [ ] Compile the exact frozen `contracts/IntentSeal.sol` source.
- [ ] Re-run the complete Hardhat test suite.
- [ ] Deploy the same contract through an explicitly approved manual action.
- [ ] Record the deployment transaction hash.
- [ ] Record the deployment block number and timestamp.
- [ ] Record the actual mainnet contract address.
- [ ] Confirm the address and transaction are visible in the explorer.
- [ ] Insert the real address into network/environment configuration; never invent it.
- [ ] Smoke-test `createIntent` with a small real intent.
- [ ] Smoke-test `completeIntent` and verify the readback hash.
- [ ] Update the README deployment table and deployment documentation.
- [ ] Publish the required mainnet launch announcement and retain its URL.

Current status: **MANUAL ACTION REQUIRED — mainnet contract not deployed/configured.**
