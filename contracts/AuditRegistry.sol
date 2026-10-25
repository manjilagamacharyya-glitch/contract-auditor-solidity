// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AuditRegistry
/// @notice Append-only log of smart contract audits. Only hashes and metadata
///         are stored; the full report stays off-chain.
contract AuditRegistry {
    struct Audit {
        bytes32 reportHash;
        bytes32 contractHash;
        string source;
        uint8 score;
        uint256 timestamp;
        address auditor;
    }

    Audit[] public audits;

    event AuditStored(
        uint256 indexed id,
        bytes32 indexed reportHash,
        bytes32 contractHash,
        string source,
        uint8 score,
        address auditor
    );

    function storeAudit(
        bytes32 reportHash,
        bytes32 contractHash,
        string calldata source,
        uint8 score
    ) external returns (uint256 id) {
        audits.push(Audit(reportHash, contractHash, source, score, block.timestamp, msg.sender));
        id = audits.length - 1;
        emit AuditStored(id, reportHash, contractHash, source, score, msg.sender);
    }

    function totalAudits() external view returns (uint256) {
        return audits.length;
    }
}
