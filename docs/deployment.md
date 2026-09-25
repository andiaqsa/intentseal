# IntentSeal Deployments

## BOT Chain Testnet

- Network: BOT Chain Testnet
- Chain ID: 968
- Native Currency: BOT
- RPC: https://rpc.bohr.life
- Explorer: https://scan.bohr.life
- Solidity: 0.8.20
- EVM Target: Paris
- Optimizer: Disabled

## BOT Chain Mainnet Deployment

- Network: BOT Chain Mainnet
- Chain ID: 677
- Solidity: 0.8.20
- EVM Target: Paris
- Optimizer: Disabled
- Contract Address: `0xE11B90f99876e020cAA17a76F09CF29feE0F5656`
- Deployment Transaction: `0xd560747fc6cdf37ac01ae672a20ee20b14256296beab77746551564e1f741922`
- Deployment Block: `24486746`
- Deployer: `0xa91c184BEcDe78dD6783a5708bDdDa8dF676b6B0`
- Status: Finalized
- Explorer: https://scan.botchain.ai

### Contract

- Contract: IntentSeal
- Address: `0x5F776464dFFFBb0699eF6395f8D2B6088A617c1A`
- Deployer: `0xa91c184BEcDe78dD6783a5708bDdDa8dF676b6B0`
- Deployment Block: `24213605`
- Deployment Transaction: `0xdd9484e4cccf10e95057cfc61a0d3a4eed795f5df47678c7a88644314724a765`

### Smoke Test

Test intent: `#4`

- `createIntent(bytes32)` - PASS
- `getIntent(uint256)` - PASS
- `verifyIntent()` with correct hash -> `true` - PASS
- `verifyIntent()` with incorrect hash -> `false` - PASS
- `completeIntent()` - PASS
- `verifyOutcome()` with correct hash -> `true` - PASS
- `verifyOutcome()` with incorrect hash -> `false` - PASS
- Second `completeIntent()` -> reverted - PASS

### Test Values

Intent hash:

`0x1111111111111111111111111111111111111111111111111111111111111111`

Outcome hash:

`0x2222222222222222222222222222222222222222222222222222222222222222`