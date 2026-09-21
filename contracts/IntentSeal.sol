// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IntentSeal
/// @notice Records immutable proofs of intent and their subsequent outcomes.
/// @dev Only hashes and essential metadata are stored. Intent IDs start at 1.
contract IntentSeal {
    /// @notice Reverts when a supplied intent or outcome hash is zero.
    error InvalidHash();

    /// @notice Reverts when an intent ID does not identify an existing intent.
    error IntentNotFound();

    /// @notice Reverts when a caller is not the creator of an intent.
    error NotIntentCreator();

    /// @notice Reverts when attempting to complete an intent more than once.
    error IntentAlreadyCompleted();

    /// @notice Reverts when an outcome is requested before the intent is completed.
    error IntentNotCompleted();

    /// @notice Data stored for a sealed intent and its optional outcome.
    /// @param creator Wallet that created the intent.
    /// @param intentHash Hash of the deterministic intent representation.
    /// @param outcomeHash Hash of the outcome report, or zero before completion.
    /// @param createdAt Block timestamp when the intent was created.
    /// @param completedAt Block timestamp when the outcome was recorded, or zero before completion.
    /// @param completed Whether an outcome has been recorded.
    struct Intent {
        address creator;
        bytes32 intentHash;
        bytes32 outcomeHash;
        uint256 createdAt;
        uint256 completedAt;
        bool completed;
    }

    /// @notice Emitted when a new intent is sealed.
    /// @param intentId Unique ID assigned to the intent.
    /// @param creator Wallet that created the intent.
    /// @param intentHash Hash of the deterministic intent representation.
    /// @param timestamp Block timestamp when the intent was sealed.
    event IntentSealed(
        uint256 indexed intentId,
        address indexed creator,
        bytes32 indexed intentHash,
        uint256 timestamp
    );

    /// @notice Emitted when an outcome is sealed for an intent.
    /// @param intentId ID of the completed intent.
    /// @param outcomeHash Hash of the outcome report.
    /// @param timestamp Block timestamp when the outcome was sealed.
    event OutcomeSealed(
        uint256 indexed intentId,
        bytes32 indexed outcomeHash,
        uint256 timestamp
    );

    /// @notice Total number of intents created.
    uint256 public intentCount;

    mapping(uint256 => Intent) private _intents;

    /// @notice Creates and seals a new intent.
    /// @param intentHash Hash of the deterministic intent representation.
    /// @return intentId The unique ID assigned to the new intent.
    function createIntent(bytes32 intentHash) external returns (uint256 intentId) {
        if (intentHash == bytes32(0)) revert InvalidHash();

        intentId = ++intentCount;
        _intents[intentId] = Intent({
            creator: msg.sender,
            intentHash: intentHash,
            outcomeHash: bytes32(0),
            createdAt: block.timestamp,
            completedAt: 0,
            completed: false
        });

        emit IntentSealed(intentId, msg.sender, intentHash, block.timestamp);
    }

    /// @notice Records an outcome for an existing intent.
    /// @param intentId ID of the intent to complete.
    /// @param outcomeHash Hash of the outcome report.
    function completeIntent(uint256 intentId, bytes32 outcomeHash) external {
        Intent storage intent = _intents[intentId];

        if (intent.creator == address(0)) revert IntentNotFound();
        if (msg.sender != intent.creator) revert NotIntentCreator();
        if (intent.completed) revert IntentAlreadyCompleted();
        if (outcomeHash == bytes32(0)) revert InvalidHash();

        intent.outcomeHash = outcomeHash;
        intent.completedAt = block.timestamp;
        intent.completed = true;

        emit OutcomeSealed(intentId, outcomeHash, block.timestamp);
    }

    /// @notice Returns all data stored for an intent.
    /// @param intentId ID of the intent to retrieve.
    /// @return intent The stored intent data.
    function getIntent(uint256 intentId) external view returns (Intent memory intent) {
        intent = _intents[intentId];
        if (intent.creator == address(0)) revert IntentNotFound();
    }

    /// @notice Checks whether a supplied hash matches an existing intent hash.
    /// @param intentId ID of the intent to verify.
    /// @param suppliedHash Hash to compare with the stored intent hash.
    /// @return True when the hashes match.
    function verifyIntent(uint256 intentId, bytes32 suppliedHash) external view returns (bool) {
        Intent storage intent = _intents[intentId];
        if (intent.creator == address(0)) revert IntentNotFound();

        return suppliedHash == intent.intentHash;
    }

    /// @notice Checks whether a supplied hash matches a completed intent's outcome hash.
    /// @param intentId ID of the intent whose outcome is being verified.
    /// @param suppliedHash Hash to compare with the stored outcome hash.
    /// @return True when the intent is completed and the hashes match.
    function verifyOutcome(uint256 intentId, bytes32 suppliedHash) external view returns (bool) {
        Intent storage intent = _intents[intentId];

        if (intent.creator == address(0)) revert IntentNotFound();
        if (!intent.completed) revert IntentNotCompleted();

        return suppliedHash == intent.outcomeHash;
    }
}
