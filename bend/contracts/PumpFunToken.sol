// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PumpFunToken
 * @dev Enhanced ERC20 token with supply locking, anti-rug pull safeguards, and stability mechanisms
 */
contract PumpFunToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable, ReentrancyGuard {
    
    // Custom Errors
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance(uint256 available, uint256 requested);
    error TransferLocked(address holder, uint256 amount, uint256 unlockTime);
    error ExceedsMaxTransferAmount(uint256 amount, uint256 maxAmount);
    error ExceedsMaxHolding(uint256 amount, uint256 maxHolding);
    error InvalidLockDuration(uint256 duration);
    error TokensAlreadyLocked(address holder);
    error NoLockedTokens(address holder);
    error LockNotExpired(uint256 unlockTime);
    error InvalidVotingPower();
    error ProposalNotActive();
    error AlreadyVoted();
    error InvalidProposal();
    error QuorumNotReached();
    error InvalidMintAmount(uint256 amount);
    error MintingPaused();
    error BurningPaused();
    error InvalidName();
    error InvalidSymbol();

    
    // Events
    event TokensLocked(address indexed holder, uint256 amount, uint256 unlockTime);
    event TokensUnlocked(address indexed holder, uint256 amount);
    event MaxTransferAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event MaxHoldingUpdated(uint256 oldAmount, uint256 newAmount);
    event LiquidityLocked(address indexed lpToken, uint256 amount, uint256 unlockTime);
    event ProposalCreated(uint256 indexed proposalId, address indexed creator, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event StabilityMint(uint256 amount, uint256 price);
    event StabilityBurn(uint256 amount, uint256 price);
    
    // Supply Locking Structure
    struct LockInfo {
        uint256 amount;
        uint256 unlockTime;
        bool isLocked;
    }
    
    // Governance Structure
    struct Proposal {
        uint256 id;
        address creator;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 endTime;
        bool executed;
        bool active;
        mapping(address => bool) hasVoted;
    }
    
    // State Variables
    mapping(address => LockInfo) public lockedTokens;
    mapping(address => uint256) public lastTransferTime;
    mapping(address => bool) public isWhitelisted;
    mapping(uint256 => Proposal) public proposals;
    
    uint256 public constant MIN_LOCK_DURATION = 1 days;
    uint256 public constant MAX_LOCK_DURATION = 365 days;
    uint256 public constant TRANSFER_COOLDOWN = 1 hours;
    uint256 public constant QUORUM_PERCENTAGE = 10; // 10% of total supply
    uint256 public constant VOTING_PERIOD = 7 days;
    
    uint256 public immutable MAX_SUPPLY; // 1 billion tokens

    uint256 public maxTransferAmount;
    uint256 public maxHolding;
    uint256 public proposalCount;
    uint256 public stabilityThreshold = 1000000 * 10**18; // 1M tokens
    uint256 public targetPrice = 1 * 10**18; // $1 in wei equivalent
    
    bool public transferLimitsEnabled = true;
    bool public mintingEnabled = true;
    bool public burningEnabled = true;
    bool public governanceEnabled = true;
    
    // Liquidity lock variables
    mapping(address => LockInfo) public liquidityLocks;
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 _initialSupply,
        address _owner
    ) ERC20(name, symbol) Ownable(_owner) {
        if (bytes(name).length == 0) revert InvalidName();
        if (bytes(symbol).length == 0) revert InvalidSymbol();
        if (_initialSupply == 0) revert ZeroAmount();

        MAX_SUPPLY = _initialSupply * 10**decimals(); // Set maximum supply in wei
        
        uint256 initialSupply = _initialSupply * 10**decimals();
        
        // Distribute initial supply
        uint256 creatorAmount = (initialSupply * 10) / 100; // 10% to creator
        uint256 liquidityAmount = (initialSupply * 20) / 100; // 20% for liquidity
        uint256 communityAmount = initialSupply - creatorAmount - liquidityAmount; // 70% to community
        
        _mint(_owner, creatorAmount);
        _mint(address(this), liquidityAmount + communityAmount);
        
        // Set initial limits
        maxTransferAmount = (initialSupply * 1) / 100; // 1% of total supply
        maxHolding = (initialSupply * 5) / 100; // 5% of total supply
        
        // Whitelist the contract and owner
        isWhitelisted[address(this)] = true;
        isWhitelisted[_owner] = true;
    }
    
    // Supply Locking Functions
    
    /**
     * @dev Lock tokens for a specific duration
     */
    function lockTokens(uint256 amount, uint256 duration) external {
        if (amount == 0) revert ZeroAmount();
        if (duration < MIN_LOCK_DURATION || duration > MAX_LOCK_DURATION) {
            revert InvalidLockDuration(duration);
        }
        if (lockedTokens[msg.sender].isLocked) {
            revert TokensAlreadyLocked(msg.sender);
        }
        if (balanceOf(msg.sender) < amount) {
            revert InsufficientBalance(balanceOf(msg.sender), amount);
        }
        
        uint256 unlockTime = block.timestamp + duration;
        lockedTokens[msg.sender] = LockInfo({
            amount: amount,
            unlockTime: unlockTime,
            isLocked: true
        });
        
        emit TokensLocked(msg.sender, amount, unlockTime);
    }
    
    /**
     * @dev Unlock tokens after lock period expires
     */
    function unlockTokens() external {
        LockInfo storage lockInfo = lockedTokens[msg.sender];
        if (!lockInfo.isLocked) revert NoLockedTokens(msg.sender);
        if (block.timestamp < lockInfo.unlockTime) {
            revert LockNotExpired(lockInfo.unlockTime);
        }
        
        uint256 amount = lockInfo.amount;
        delete lockedTokens[msg.sender];
        
        emit TokensUnlocked(msg.sender, amount);
    }
    
    /**
     * @dev Lock liquidity tokens to prevent rug pulls
     */
    function lockLiquidity(address lpToken, uint256 amount, uint256 duration) external onlyOwner {
        if (lpToken == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (duration < MIN_LOCK_DURATION) revert InvalidLockDuration(duration);
        
        IERC20(lpToken).transferFrom(msg.sender, address(this), amount);
        
        uint256 unlockTime = block.timestamp + duration;
        liquidityLocks[lpToken] = LockInfo({
            amount: amount,
            unlockTime: unlockTime,
            isLocked: true
        });
        
        emit LiquidityLocked(lpToken, amount, unlockTime);
    }
    
    // Anti-Rug Pull Functions
    
    /**
     * @dev Override transfer to implement anti-rug pull measures
     */
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Pausable) {
        if (from != address(0) && to != address(0)) {
            _checkTransferRestrictions(from, to, amount);
        }
        super._update(from, to, amount);
    }
    
    /**
     * @dev Check transfer restrictions to prevent rug pulls
     */
    function _checkTransferRestrictions(address from, address to, uint256 amount) internal {
        // Check if tokens are locked
        if (lockedTokens[from].isLocked && 
            lockedTokens[from].amount >= amount && 
            block.timestamp < lockedTokens[from].unlockTime) {
            revert TransferLocked(from, amount, lockedTokens[from].unlockTime);
        }
        
        // Skip restrictions for whitelisted addresses
        if (isWhitelisted[from] || isWhitelisted[to]) {
            return;
        }
        
        // Check transfer limits
        if (transferLimitsEnabled) {
            if (amount > maxTransferAmount) {
                revert ExceedsMaxTransferAmount(amount, maxTransferAmount);
            }
            
            // Check max holding limit for recipient
            if (balanceOf(to) + amount > maxHolding) {
                revert ExceedsMaxHolding(balanceOf(to) + amount, maxHolding);
            }
            
            // Check transfer cooldown
            if (block.timestamp < lastTransferTime[from] + TRANSFER_COOLDOWN) {
                revert TransferLocked(from, amount, lastTransferTime[from] + TRANSFER_COOLDOWN);
            }
        }
        
        lastTransferTime[from] = block.timestamp;
    }
    
    // Governance Functions
    
    /**
     * @dev Create a governance proposal
     */
    function createProposal(string memory description) external returns (uint256) {
        if (!governanceEnabled) revert InvalidVotingPower();
        if (balanceOf(msg.sender) < (totalSupply() * 1) / 100) revert InvalidVotingPower(); // Need 1% to propose
        
        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.creator = msg.sender;
        proposal.description = description;
        proposal.endTime = block.timestamp + VOTING_PERIOD;
        proposal.active = true;
        
        emit ProposalCreated(proposalId, msg.sender, description);
        return proposalId;
    }
    
    /**
     * @dev Vote on a proposal
     */
    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.active) revert ProposalNotActive();
        if (block.timestamp >= proposal.endTime) revert ProposalNotActive();
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();
        
        uint256 votingPower = balanceOf(msg.sender);
        if (votingPower == 0) revert InvalidVotingPower();
        
        proposal.hasVoted[msg.sender] = true;
        
        if (support) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }
        
        emit VoteCast(proposalId, msg.sender, support, votingPower);
    }
    
    /**
     * @dev Execute a proposal if it passes
     */
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.active) revert InvalidProposal();
        if (block.timestamp < proposal.endTime) revert ProposalNotActive();
        if (proposal.executed) revert InvalidProposal();
        
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        uint256 quorum = (totalSupply() * QUORUM_PERCENTAGE) / 100;
        
        if (totalVotes < quorum) revert QuorumNotReached();
        
        proposal.executed = true;
        proposal.active = false;
        
        emit ProposalExecuted(proposalId);
    }
    
    // Stability Functions
    
    /**
     * @dev Mint tokens to maintain price stability
     */
    function stabilityMint(uint256 amount, uint256 currentPrice) external onlyOwner {
        if (!mintingEnabled) revert MintingPaused();
        if (amount == 0) revert InvalidMintAmount(amount);
        if (totalSupply() + amount > MAX_SUPPLY) revert InvalidMintAmount(amount);
        
        // Only mint if price is above target and supply is below threshold
        if (currentPrice > targetPrice && totalSupply() < stabilityThreshold) {
            _mint(address(this), amount);
            emit StabilityMint(amount, currentPrice);
        }
    }
    
    /**
     * @dev Burn tokens to maintain price stability
     */
    function stabilityBurn(uint256 amount, uint256 currentPrice) external onlyOwner {
        if (!burningEnabled) revert BurningPaused();
        if (amount == 0) revert ZeroAmount();
        if (balanceOf(address(this)) < amount) {
            revert InsufficientBalance(balanceOf(address(this)), amount);
        }
        
        // Only burn if price is below target
        if (currentPrice < targetPrice) {
            _burn(address(this), amount);
            emit StabilityBurn(amount, currentPrice);
        }
    }
    
    // Admin Functions
    
    /**
     * @dev Update maximum transfer amount
     */
    function setMaxTransferAmount(uint256 newAmount) external onlyOwner {
        uint256 oldAmount = maxTransferAmount;
        maxTransferAmount = newAmount;
        emit MaxTransferAmountUpdated(oldAmount, newAmount);
    }
    
    /**
     * @dev Update maximum holding amount
     */
    function setMaxHolding(uint256 newAmount) external onlyOwner {
        uint256 oldAmount = maxHolding;
        maxHolding = newAmount;
        emit MaxHoldingUpdated(oldAmount, newAmount);
    }
    
    /**
     * @dev Add/remove address from whitelist
     */
    function setWhitelisted(address account, bool whitelisted) external onlyOwner {
        isWhitelisted[account] = whitelisted;
    }
    
    /**
     * @dev Enable/disable transfer limits
     */
    function setTransferLimitsEnabled(bool enabled) external onlyOwner {
        transferLimitsEnabled = enabled;
    }
    
    /**
     * @dev Enable/disable minting
     */
    function setMintingEnabled(bool enabled) external onlyOwner {
        mintingEnabled = enabled;
    }
    
    /**
     * @dev Enable/disable burning
     */
    function setBurningEnabled(bool enabled) external onlyOwner {
        burningEnabled = enabled;
    }
    
    /**
     * @dev Enable/disable governance
     */
    function setGovernanceEnabled(bool enabled) external onlyOwner {
        governanceEnabled = enabled;
    }
    
    /**
     * @dev Set target price for stability mechanism
     */
    function setTargetPrice(uint256 newPrice) external onlyOwner {
        targetPrice = newPrice;
    }
    
    // View Functions
    
    /**
     * @dev Get locked token information
     */
    function getLockedTokens(address holder) external view returns (uint256 amount, uint256 unlockTime, bool isLocked) {
        LockInfo memory lockInfo = lockedTokens[holder];
        return (lockInfo.amount, lockInfo.unlockTime, lockInfo.isLocked);
    }
    
    /**
     * @dev Get proposal information
     */
    function getProposal(uint256 proposalId) external view returns (
        address creator,
        string memory description,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 endTime,
        bool executed,
        bool active
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.creator,
            proposal.description,
            proposal.votesFor,
            proposal.votesAgainst,
            proposal.endTime,
            proposal.executed,
            proposal.active
        );
    }
    
    /**
     * @dev Check if address has voted on proposal
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }
    
    /**
     * @dev Get available balance (excluding locked tokens)
     */
    function getAvailableBalance(address holder) external view returns (uint256) {
        uint256 balance = balanceOf(holder);
        LockInfo memory lockInfo = lockedTokens[holder];
        
        if (lockInfo.isLocked && block.timestamp < lockInfo.unlockTime) {
            return balance > lockInfo.amount ? balance - lockInfo.amount : 0;
        }
        
        return balance;
    }
    
    // Emergency Functions
    
    /**
     * @dev Emergency pause all transfers
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Emergency unpause all transfers
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency unlock liquidity (only after significant time)
     */
    function emergencyUnlockLiquidity(address lpToken) external onlyOwner {
        LockInfo storage lockInfo = liquidityLocks[lpToken];
        require(lockInfo.isLocked, "No liquidity locked");
        require(block.timestamp > lockInfo.unlockTime + 30 days, "Emergency unlock too early");
        
        IERC20(lpToken).transfer(owner(), lockInfo.amount);
        delete liquidityLocks[lpToken];
    }
}
