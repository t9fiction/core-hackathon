// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract PumpFunGovernanceAirdrop is Ownable, ReentrancyGuard {
    // Custom Errors
    error PumpFunGovernanceAirdrop__InvalidProof();
    error PumpFunGovernanceAirdrop__AlreadyClaimed();
    error PumpFunGovernanceAirdrop__InsufficientBalance();
    error PumpFunGovernanceAirdrop__TransferFailed();
    error PumpFunGovernanceAirdrop__InvalidMerkleRoot();
    error PumpFunGovernanceAirdrop__AirdropNotActive();
    error PumpFunGovernanceAirdrop__InvalidAmount();

    // Events
    event AirdropClaimed(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    event MerkleRootUpdated(
        bytes32 indexed oldRoot,
        bytes32 indexed newRoot,
        address indexed token
    );

    event AirdropConfigured(
        address indexed token,
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 startTime,
        uint256 endTime
    );

    event EmergencyWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    // Structs
    struct AirdropConfig {
        bytes32 merkleRoot;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 endTime;
        bool active;
    }

    // State Variables
    address public governanceContract;
    
    // Mappings
    mapping(address => AirdropConfig) public airdrops; // token => airdrop config
    mapping(address => mapping(address => bool)) public hasClaimed; // token => user => claimed
    mapping(address => mapping(address => uint256)) public claimedAmounts; // token => user => amount

    // Statistics
    uint256 public totalAirdropsConfigured;
    uint256 public totalTokensDistributed;

    constructor(address _governanceContract) Ownable(msg.sender) {
        governanceContract = _governanceContract;
    }

    /**
     * @dev Configure a new airdrop for a token
     */
    function configureAirdrop(
        address token,
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 duration
    ) external onlyOwner {
        if (merkleRoot == bytes32(0)) revert PumpFunGovernanceAirdrop__InvalidMerkleRoot();
        if (totalAmount == 0) revert PumpFunGovernanceAirdrop__InvalidAmount();

        // Check that contract has sufficient token balance
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        if (contractBalance < totalAmount) revert PumpFunGovernanceAirdrop__InsufficientBalance();

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;

        airdrops[token] = AirdropConfig({
            merkleRoot: merkleRoot,
            totalAmount: totalAmount,
            claimedAmount: 0,
            startTime: startTime,
            endTime: endTime,
            active: true
        });

        totalAirdropsConfigured++;

        emit AirdropConfigured(token, merkleRoot, totalAmount, startTime, endTime);
    }

    /**
     * @dev Claim airdrop tokens using merkle proof
     */
    function claimAirdrop(
        address token,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        AirdropConfig storage config = airdrops[token];
        
        if (!config.active) revert PumpFunGovernanceAirdrop__AirdropNotActive();
        if (block.timestamp < config.startTime || block.timestamp > config.endTime) {
            revert PumpFunGovernanceAirdrop__AirdropNotActive();
        }
        if (hasClaimed[token][msg.sender]) revert PumpFunGovernanceAirdrop__AlreadyClaimed();

        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(merkleProof, config.merkleRoot, leaf)) {
            revert PumpFunGovernanceAirdrop__InvalidProof();
        }

        // Check if there are enough tokens remaining
        if (config.claimedAmount + amount > config.totalAmount) {
            revert PumpFunGovernanceAirdrop__InsufficientBalance();
        }

        // Update state
        hasClaimed[token][msg.sender] = true;
        claimedAmounts[token][msg.sender] = amount;
        config.claimedAmount += amount;
        totalTokensDistributed += amount;

        // Transfer tokens
        bool success = IERC20(token).transfer(msg.sender, amount);
        if (!success) revert PumpFunGovernanceAirdrop__TransferFailed();

        emit AirdropClaimed(msg.sender, token, amount, block.timestamp);
    }

    /**
     * @dev Batch claim for multiple users (gas optimization)
     */
    function batchClaimAirdrop(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32[][] calldata merkleProofs
    ) external nonReentrant {
        if (recipients.length != amounts.length || recipients.length != merkleProofs.length) {
            revert PumpFunGovernanceAirdrop__InvalidAmount();
        }

        AirdropConfig storage config = airdrops[token];
        
        if (!config.active) revert PumpFunGovernanceAirdrop__AirdropNotActive();
        if (block.timestamp < config.startTime || block.timestamp > config.endTime) {
            revert PumpFunGovernanceAirdrop__AirdropNotActive();
        }

        uint256 totalBatchAmount = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];
            bytes32[] calldata proof = merkleProofs[i];

            if (hasClaimed[token][recipient]) continue; // Skip already claimed

            // Verify merkle proof
            bytes32 leaf = keccak256(abi.encodePacked(recipient, amount));
            if (!MerkleProof.verify(proof, config.merkleRoot, leaf)) continue; // Skip invalid proof

            // Update state
            hasClaimed[token][recipient] = true;
            claimedAmounts[token][recipient] = amount;
            totalBatchAmount += amount;

            // Transfer tokens
            bool success = IERC20(token).transfer(recipient, amount);
            if (success) {
                emit AirdropClaimed(recipient, token, amount, block.timestamp);
            }
        }

        // Update total claimed amount
        config.claimedAmount += totalBatchAmount;
        totalTokensDistributed += totalBatchAmount;
    }

    /**
     * @dev Update merkle root for an airdrop (emergency function)
     */
    function updateMerkleRoot(address token, bytes32 newMerkleRoot) external onlyOwner {
        if (newMerkleRoot == bytes32(0)) revert PumpFunGovernanceAirdrop__InvalidMerkleRoot();
        
        bytes32 oldRoot = airdrops[token].merkleRoot;
        airdrops[token].merkleRoot = newMerkleRoot;

        emit MerkleRootUpdated(oldRoot, newMerkleRoot, token);
    }

    /**
     * @dev Deactivate an airdrop
     */
    function deactivateAirdrop(address token) external onlyOwner {
        airdrops[token].active = false;
    }

    /**
     * @dev Reactivate an airdrop
     */
    function reactivateAirdrop(address token) external onlyOwner {
        airdrops[token].active = true;
    }

    /**
     * @dev Extend airdrop duration
     */
    function extendAirdrop(address token, uint256 additionalTime) external onlyOwner {
        airdrops[token].endTime += additionalTime;
    }

    /**
     * @dev Emergency withdraw tokens from contract
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        if (amount == 0) revert PumpFunGovernanceAirdrop__InvalidAmount();
        
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        if (contractBalance < amount) revert PumpFunGovernanceAirdrop__InsufficientBalance();

        bool success = IERC20(token).transfer(to, amount);
        if (!success) revert PumpFunGovernanceAirdrop__TransferFailed();

        emit EmergencyWithdraw(token, to, amount);
    }

    /**
     * @dev Get airdrop information
     */
    function getAirdropInfo(address token) external view returns (
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 claimedAmount,
        uint256 startTime,
        uint256 endTime,
        bool active,
        uint256 remainingAmount
    ) {
        AirdropConfig memory config = airdrops[token];
        return (
            config.merkleRoot,
            config.totalAmount,
            config.claimedAmount,
            config.startTime,
            config.endTime,
            config.active,
            config.totalAmount - config.claimedAmount
        );
    }

    /**
     * @dev Check if user can claim airdrop
     */
    function canClaim(address token, address user) external view returns (bool) {
        AirdropConfig memory config = airdrops[token];
        return config.active &&
               !hasClaimed[token][user] &&
               block.timestamp >= config.startTime &&
               block.timestamp <= config.endTime;
    }

    /**
     * @dev Get claimed amount for a user
     */
    function getClaimedAmount(address token, address user) external view returns (uint256) {
        return claimedAmounts[token][user];
    }

    /**
     * @dev Check if airdrop is active
     */
    function isAirdropActive(address token) external view returns (bool) {
        AirdropConfig memory config = airdrops[token];
        return config.active &&
               block.timestamp >= config.startTime &&
               block.timestamp <= config.endTime;
    }

    /**
     * @dev Get total remaining tokens for all airdrops
     */
    function getTotalRemainingTokens(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Verify merkle proof for a claim (helper function)
     */
    function verifyProof(
        address token,
        address user,
        uint256 amount,
        bytes32[] calldata proof
    ) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(user, amount));
        return MerkleProof.verify(proof, airdrops[token].merkleRoot, leaf);
    }

    /**
     * @dev Update governance contract address
     */
    function updateGovernanceContract(address newGovernanceContract) external onlyOwner {
        governanceContract = newGovernanceContract;
    }

    /**
     * @dev Get contract statistics
     */
    function getContractStats() external view returns (
        uint256 _totalAirdropsConfigured,
        uint256 _totalTokensDistributed
    ) {
        return (totalAirdropsConfigured, totalTokensDistributed);
    }

    /**
     * @dev Receive tokens for airdrops
     */
    receive() external payable {
        // Contract can receive ETH if needed
    }

    /**
     * @dev Fallback function
     */
    fallback() external payable {
        // Handle unexpected calls
    }
}
