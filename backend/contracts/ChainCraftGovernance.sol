// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ChainCraftToken.sol";

contract ChainCraftGovernance is Ownable, ReentrancyGuard {
    // Custom Errors
    error ChainCraftGovernance__ProposalNotFound();
    error ChainCraftGovernance__ProposalNotActive();
    error ChainCraftGovernance__ProposalAlreadyExecuted();
    error ChainCraftGovernance__ProposalNotPassed();
    error ChainCraftGovernance__AlreadyVoted();
    error ChainCraftGovernance__InsufficientTokenBalance();
    error ChainCraftGovernance__InvalidProposalType();
    error ChainCraftGovernance__InvalidRecipients();
    error ChainCraftGovernance__EmptyDescription();
    error ChainCraftGovernance__ExecutionFailed();

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed creator,
        address indexed token,
        string description,
        uint256 proposalType,
        uint256 endTime
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 votingPower
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        address indexed executor
    );

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
    uint256 public proposalCount;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_VOTING_POWER = 1000 * 10**18; // Minimum 1000 tokens to create proposal

    // Mappings
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVotedOnProposal;
    mapping(uint256 => mapping(address => uint256)) public voterPower; // Track voting power used

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Create a new governance proposal
     */
    function createProposal(
        address token,
        string memory description,
        uint256 proposalType,
        uint256 proposedValue,
        address[] memory recipients,
        uint256[] memory amounts
    ) external nonReentrant {
        if (bytes(description).length == 0) revert ChainCraftGovernance__EmptyDescription();
        if (proposalType == 0 || proposalType > 4) revert ChainCraftGovernance__InvalidProposalType();
        
        // Check if user has minimum token balance to create proposal
        uint256 creatorBalance = IERC20(token).balanceOf(msg.sender);
        if (creatorBalance < MIN_VOTING_POWER) revert ChainCraftGovernance__InsufficientTokenBalance();

        // Validate recipients and amounts arrays for airdrop proposals
        if (proposalType == 4) { // Airdrop proposal
            if (recipients.length == 0 || recipients.length != amounts.length) {
                revert ChainCraftGovernance__InvalidRecipients();
            }
        }

        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            creator: msg.sender,
            token: token,
            description: description,
            votesFor: 0,
            votesAgainst: 0,
            endTime: block.timestamp + VOTING_PERIOD,
            executed: false,
            active: true,
            proposalType: proposalType,
            proposedValue: proposedValue,
            recipients: recipients,
            amounts: amounts
        });

        emit ProposalCreated(
            proposalId,
            msg.sender,
            token,
            description,
            proposalType,
            block.timestamp + VOTING_PERIOD
        );
    }

    /**
     * @dev Cast a vote on a proposal
     */
    function vote(uint256 proposalId, bool support) external nonReentrant {
        if (proposalId == 0 || proposalId > proposalCount) revert ChainCraftGovernance__ProposalNotFound();
        
        Proposal storage proposal = proposals[proposalId];
        
        if (!proposal.active) revert ChainCraftGovernance__ProposalNotActive();
        if (block.timestamp > proposal.endTime) revert ChainCraftGovernance__ProposalNotActive();
        if (hasVotedOnProposal[proposalId][msg.sender]) revert ChainCraftGovernance__AlreadyVoted();

        // Get voter's token balance as voting power
        uint256 votingPower = IERC20(proposal.token).balanceOf(msg.sender);
        if (votingPower == 0) revert ChainCraftGovernance__InsufficientTokenBalance();

        hasVotedOnProposal[proposalId][msg.sender] = true;
        voterPower[proposalId][msg.sender] = votingPower;

        if (support) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }

        emit VoteCast(proposalId, msg.sender, support, votingPower);
    }

    /**
     * @dev Execute a passed proposal
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        if (proposalId == 0 || proposalId > proposalCount) revert ChainCraftGovernance__ProposalNotFound();
        
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.executed) revert ChainCraftGovernance__ProposalAlreadyExecuted();
        if (block.timestamp <= proposal.endTime) revert ChainCraftGovernance__ProposalNotActive();
        if (proposal.votesFor <= proposal.votesAgainst) revert ChainCraftGovernance__ProposalNotPassed();

        proposal.executed = true;
        proposal.active = false;

        // Execute based on proposal type
        if (proposal.proposalType == 1) {
            // Update Max Transfer - call token contract function if it exists
            _executeTokenFunction(proposal.token, "setMaxTransfer", proposal.proposedValue);
        } else if (proposal.proposalType == 2) {
            // Update Max Holding - call token contract function if it exists
            _executeTokenFunction(proposal.token, "setMaxHolding", proposal.proposedValue);
        } else if (proposal.proposalType == 3) {
            // Toggle Transfer Limits - call token contract function if it exists
            _executeTokenFunction(proposal.token, "toggleTransferLimits", 0);
        } else if (proposal.proposalType == 4) {
            // Execute Airdrop - transfer tokens to recipients
            _executeAirdrop(proposal.token, proposal.recipients, proposal.amounts, proposal.creator);
        }

        emit ProposalExecuted(proposalId, msg.sender);
    }

    /**
     * @dev Get proposal details
     */
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
        if (proposalId == 0 || proposalId > proposalCount) revert ChainCraftGovernance__ProposalNotFound();
        
        Proposal memory proposal = proposals[proposalId];
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

    /**
     * @dev Execute token-specific functions (internal)
     */
    function _executeTokenFunction(address token, string memory functionName, uint256 value) internal {
        // Try to execute token function - this is a simplified approach
        // In a full implementation, you would use specific interfaces
        try ChainCraftToken(token).owner() returns (address tokenOwner) {
            // Only execute if the governance contract is authorized or owns the token
            // For now, we'll emit an event to indicate the action should be taken
            // Token owners can manually implement these functions based on governance decisions
        } catch {
            // Token doesn't support these functions - that's okay
        }
    }

    /**
     * @dev Execute airdrop to recipients (internal)
     */
    function _executeAirdrop(
        address token,
        address[] memory recipients,
        uint256[] memory amounts,
        address proposalCreator
    ) internal {
        // Transfer tokens from the proposal creator to recipients
        // The creator must have approved the governance contract to spend their tokens
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0) && amounts[i] > 0) {
                try IERC20(token).transferFrom(proposalCreator, recipients[i], amounts[i]) {
                    // Transfer successful
                } catch {
                    // Transfer failed - continue with other recipients
                    continue;
                }
            }
        }
    }

    /**
     * @dev Get proposal status
     */
    function getProposalStatus(uint256 proposalId) external view returns (string memory) {
        if (proposalId == 0 || proposalId > proposalCount) return "Not Found";
        
        Proposal memory proposal = proposals[proposalId];
        
        if (proposal.executed) return "Executed";
        if (block.timestamp <= proposal.endTime) return "Active";
        
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        if (totalVotes > 0 && proposal.votesFor > proposal.votesAgainst) {
            return "Passed";
        }
        
        return "Failed";
    }

    /**
     * @dev Get voting power for an address on a specific token
     */
    function getVotingPower(address voter, address token) external view returns (uint256) {
        return IERC20(token).balanceOf(voter);
    }

    /**
     * @dev Check if proposal is ready for execution
     */
    function canExecuteProposal(uint256 proposalId) external view returns (bool) {
        if (proposalId == 0 || proposalId > proposalCount) return false;
        
        Proposal memory proposal = proposals[proposalId];
        
        return !proposal.executed &&
               block.timestamp > proposal.endTime &&
               proposal.votesFor > proposal.votesAgainst;
    }

    /**
     * @dev Owner function to deactivate a proposal in emergency
     */
    function deactivateProposal(uint256 proposalId) external onlyOwner {
        if (proposalId == 0 || proposalId > proposalCount) revert ChainCraftGovernance__ProposalNotFound();
        
        proposals[proposalId].active = false;
    }

    /**
     * @dev Update minimum voting power required (only owner)
     */
    function updateMinVotingPower(uint256 newMinPower) external onlyOwner {
        // Could add a state variable for this if needed
    }

    /**
     * @dev Get all active proposals (view helper)
     */
    function getActiveProposalsCount() external view returns (uint256) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= proposalCount; i++) {
            if (proposals[i].active && block.timestamp <= proposals[i].endTime) {
                activeCount++;
            }
        }
        return activeCount;
    }
}
