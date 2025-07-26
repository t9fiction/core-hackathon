// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface for PumpFunToken to allow governance actions
interface IPumpFunToken {
    function setMaxTransferAmount(uint256 amount) external;
    function setMaxHolding(uint256 amount) external;
    function setTransferLimitsEnabled(bool enabled) external;
    function transferAirdrop(address[] calldata recipients, uint256[] calldata amounts) external;
}

// Interface for PumpFunGovernanceAirdrop
interface IPumpFunGovernanceAirdrop {
    function executeAirdrop(address[] calldata recipients, uint256[] calldata amounts) external;
}

/**
 * @title PumpFunGovernance
 * @dev Governance contract with DAO rules for PumpFunToken instances and airdrop support
 */
contract PumpFunGovernance is Ownable, ReentrancyGuard {
    // Custom Errors
    error PumpFunGovernance__GovernanceDisabled();
    error PumpFunGovernance__InvalidToken();
    error PumpFunGovernance__InvalidProposalType();
    error PumpFunGovernance__InvalidVotingPower();
    error PumpFunGovernance__ProposalNotActive();
    error PumpFunGovernance__VotingPeriodEnded();
    error PumpFunGovernance__AlreadyVoted();
    error PumpFunGovernance__NoVotingPower();
    error PumpFunGovernance__QuorumNotReached();
    error PumpFunGovernance__ProposalAlreadyExecuted();
    error PumpFunGovernance__InvalidAirdropArrays();
    error PumpFunGovernance__InvalidAirdropContract();
    error PumpFunGovernance__VotingPeriodNotEnded();

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed creator, address token, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votingPower);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);
    event GovernanceEnabled(bool enabled);
    event AirdropContractUpdated(address indexed oldAirdrop, address indexed newAirdrop);

    // Structs
    struct Proposal {
        address creator;
        address token;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 endTime;
        bool executed;
        bool active;
        uint256 proposalType;
        uint256 proposedValue;
        address[] recipients;
        uint256[] amounts;
    }

    // State Variables
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MINIMUM_VOTING_POWER = 1;
    uint256 public constant QUORUM_PERCENTAGE = 10;
    bool public governanceEnabled = true;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    address public airdropContract;

    constructor() Ownable(msg.sender) {}

    function createProposal(
        address token,
        string memory description,
        uint256 proposalType,
        uint256 proposedValue,
        address[] memory recipients,
        uint256[] memory amounts
    ) external returns (uint256) {
        if (!governanceEnabled) revert PumpFunGovernance__GovernanceDisabled();
        if (token == address(0)) revert PumpFunGovernance__InvalidToken();
        if (proposalType > 4) revert PumpFunGovernance__InvalidProposalType();
        uint256 totalSupply = IERC20(token).totalSupply();
        uint256 votingPower = IERC20(token).balanceOf(msg.sender);
        if (votingPower * 100 < totalSupply * MINIMUM_VOTING_POWER) revert PumpFunGovernance__InvalidVotingPower();

        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        proposal.creator = msg.sender;
        proposal.token = token;
        proposal.description = description;
        proposal.votesFor = 0;
        proposal.votesAgainst = 0;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        proposal.executed = false;
        proposal.active = true;
        proposal.proposalType = proposalType;
        proposal.proposedValue = proposedValue;
        if (proposalType == 4) {
            if (recipients.length != amounts.length) revert PumpFunGovernance__InvalidAirdropArrays();
            if (airdropContract == address(0)) revert PumpFunGovernance__InvalidAirdropContract();
            proposal.recipients = recipients;
            proposal.amounts = amounts;
        }

        emit ProposalCreated(proposalId, msg.sender, token, description);
        return proposalId;
    }

    function vote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.active) revert PumpFunGovernance__ProposalNotActive();
        if (block.timestamp >= proposal.endTime) revert PumpFunGovernance__VotingPeriodEnded();
        if (hasVoted[proposalId][msg.sender]) revert PumpFunGovernance__AlreadyVoted();

        uint256 votingPower = IERC20(proposal.token).balanceOf(msg.sender);
        if (votingPower == 0) revert PumpFunGovernance__NoVotingPower();

        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }

        emit VoteCast(proposalId, msg.sender, support, votingPower);
    }

    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.active) revert PumpFunGovernance__ProposalNotActive();
        if (block.timestamp < proposal.endTime) revert PumpFunGovernance__VotingPeriodNotEnded();
        if (proposal.executed) revert PumpFunGovernance__ProposalAlreadyExecuted();

        uint256 totalSupply = IERC20(proposal.token).totalSupply();
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        if (totalVotes * 100 < totalSupply * QUORUM_PERCENTAGE) revert PumpFunGovernance__QuorumNotReached();

        proposal.executed = true;
        proposal.active = false;

        if (proposal.proposalType == 1) {
            IPumpFunToken(proposal.token).setMaxTransferAmount(proposal.proposedValue);
        } else if (proposal.proposalType == 2) {
            IPumpFunToken(proposal.token).setMaxHolding(proposal.proposedValue);
        } else if (proposal.proposalType == 3) {
            IPumpFunToken(proposal.token).setTransferLimitsEnabled(proposal.proposedValue == 1);
        } else if (proposal.proposalType == 4) {
            IPumpFunToken(proposal.token).transferAirdrop(proposal.recipients, proposal.amounts);
            IPumpFunGovernanceAirdrop(airdropContract).executeAirdrop(proposal.recipients, proposal.amounts);
        }

        emit ProposalExecuted(proposalId, msg.sender);
    }

    function setAirdropContract(address _airdropContract) external onlyOwner {
        if (_airdropContract == address(0)) revert PumpFunGovernance__InvalidAirdropContract();
        address oldAirdrop = airdropContract;
        airdropContract = _airdropContract;
        emit AirdropContractUpdated(oldAirdrop, _airdropContract);
    }

    function setGovernanceEnabled(bool enabled) external onlyOwner {
        governanceEnabled = enabled;
        emit GovernanceEnabled(enabled);
    }

    function getProposal(uint256 proposalId) external view returns (
        address creator,
        address token,
        string memory description,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 endTime,
        bool executed,
        bool active,
        uint256 proposalType,
        uint256 proposedValue,
        address[] memory recipients,
        uint256[] memory amounts
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.creator,
            proposal.token,
            proposal.description,
            proposal.votesFor,
            proposal.votesAgainst,
            proposal.endTime,
            proposal.executed,
            proposal.active,
            proposal.proposalType,
            proposal.proposedValue,
            proposal.recipients,
            proposal.amounts
        );
    }

    function hasVotedOnProposal(uint256 proposalId, address voter) external view returns (bool) {
        return hasVoted[proposalId][voter];
    }
}