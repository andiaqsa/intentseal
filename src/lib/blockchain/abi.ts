export const INTENTSEAL_ABI = [
  "function createIntent(bytes32 intentHash) returns (uint256 intentId)",
  "function getIntent(uint256 intentId) view returns ((address creator, bytes32 intentHash, bytes32 outcomeHash, uint256 createdAt, uint256 completedAt, bool completed) intent)",
  "function intentCount() view returns (uint256)",
  "event IntentSealed(uint256 indexed intentId, address indexed creator, bytes32 indexed intentHash, uint256 timestamp)",
] as const;
