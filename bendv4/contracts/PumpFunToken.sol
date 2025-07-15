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
 * @dev Enhanced meme token with anti-rug pull mechanisms, supply locking, and governance
 */
contract PumpFunToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable, ReentrancyGuard {
    
    // Custom Errors
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance(uint256 available, uint256 requested);
    error TransferLocked(address holder, uint256 amount, uint256 unlockTime);
    error ExceedsMaxTransferAmount(uint256 amount, uint256 maxAmount);
    error TokensAlreadyLocked(address holder);
    error NoLockedTokens(address holder);
    error LockNotExpired(uint256 unlockTime);
    error InvalidLockDuration(uint256 duration);
    error InvalidMintAmount(uint256 amount);
    error MintingDisabled();
    error BurningDisabled();
    error InvalidProposal();
    error QuorumNotReached();
    error ProposalNotActive();
    error AlreadyVoted();
    
    // Events
    event TokensLocked(address indexed holder, uint256 amount, uint256 unlockTime);
    event TokensUnlocked(address indexed holder, uint256 amount);
    event LiquidityLocked(address indexed lpToken, uint256 amount, uint256 unlockTime);
    event MaxTransferAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event ProposalCreated(uint256 indexed proposalId, address indexed creator, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event StabilityAction(uint256 amount, bool isMint, uint256 price);
    
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
    mapping(address => LockInfo) public liquidityLocks;
    mapping(address => bool) public isWhitelisted;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public lastTransferTime;
    
    uint256 public constant MIN_LOCK_DURATION = 1 days;
    uint256 public constant MAX_LOCK_DURATION = 365 days;
    uint256 public constant TRANSFER_COOLDOWN = 1 hours;
    uint256 public constant QUORUM_PERCENTAGE = 10; // 10% of total supply
    uint256 public constant VOTING_PERIOD = 7 days;
    
    uint256 public immutable MAX_SUPPLY;
    uint256 public maxTransferAmount;
    uint256 public proposalCount;
    uint256 public stabilityThreshold = 1000000 * 10**18; // 1M tokens
    uint256 public targetPrice = 1 * 10**18; // $1 target price
    
    bool public transferLimitsEnabled = true;
    bool public mintingEnabled = true;
    bool public burningEnabled = true;
    bool public governanceEnabled = true;
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 _initialSupply,
        address _owner
    ) 
        ERC20(name, symbol) 
        Ownable(_owner) 
    {
        if (_initialSupply == 0) revert ZeroAmount();
        if (_owner == address(0)) revert ZeroAddress();

        MAX_SUPPLY = _initialSupply * 10**decimals();
        uint256 initialSupply = _initialSupply * 10**decimals();
        
        // Distribute initial supply
        uint256 creatorAmount = (initialSupply * 10) / 100; // 10% to creator
        uint256 liquidityAmount = (initialSupply * 20) / 100; // 20% for liquidity
        uint256 communityAmount = initialSupply - creatorAmount - liquidityAmount; // 70% to community
        
        _mint(_owner, creatorAmount);
        _mint(address(this), liquidityAmount + communityAmount);
        
        // Set initial limits (1% of total supply)
        maxTransferAmount = (initialSupply * 1) / 100;
        
        // Whitelist the contract and owner
        isWhitelisted[address(this)] = true;
        isWhitelisted[_owner] = true;
    }
    
    // Supply Locking Functions
    
    /**
     * @dev Lock tokens for a specific duration to prevent dumps
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
    
    // Anti-Rug Pull Transfer Override
    
    /**
     * @dev Override transfer to implement anti-rug pull measures
     */
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Pausable) {
        if (from != address(0) && to != address(0)) {
            _enforceTransferRestrictions(from, to, amount);
        }
        super._update(from, to, amount);
    }
    
    /**
     * @dev Enforce transfer restrictions to prevent rug pulls
     */
    function _enforceTransferRestrictions(address from, address to, uint256 amount) internal {
        if (!isWhitelisted[from] && transferLimitsEnabled) {
            // Check if tokens are locked
            LockInfo storage lockInfo = lockedTokens[from];
            if (lockInfo.isLocked && lockInfo.amount >= amount) {
                revert TransferLocked(from, amount, lockInfo.unlockTime);
            }
            
            // Check max transfer amount
            if (amount > maxTransferAmount) {
                revert ExceedsMaxTransferAmount(amount, maxTransferAmount);
            }
            
            // Enforce transfer cooldown
            if (block.timestamp < lastTransferTime[from] + TRANSFER_COOLDOWN) {
                revert TransferLocked(from, amount, lastTransferTime[from] + TRANSFER_COOLDOWN);
            }
            
            lastTransferTime[from] = block.timestamp;
        }
    }
    
    // Stability-Oriented Tokenomics
    
    /**
     * @dev Mint tokens to stabilize price (only owner)
     */
    function stabilityMint(uint256 amount, uint256 currentPrice) external onlyOwner {
        if (!mintingEnabled) revert MintingDisabled();
        if (amount == 0) revert ZeroAmount();
        if (totalSupply() + amount > MAX_SUPPLY) revert InvalidMintAmount(amount);
        
        // Only mint if price is above target and amount is reasonable
        if (currentPrice > targetPrice && amount <= stabilityThreshold) {
            _mint(address(this), amount);
            emit StabilityAction(amount, true, currentPrice);
        }
    }
    
    /**
     * @dev Burn tokens to stabilize price (only owner)
     */
    function stabilityBurn(uint256 amount, uint256 currentPrice) external onlyOwner {
        if (!burningEnabled) revert BurningDisabled();
        if (amount == 0) revert ZeroAmount();
        if (balanceOf(address(this)) < amount) revert InsufficientBalance(balanceOf(address(this)), amount);
        
        // Only burn if price is below target
        if (currentPrice < targetPrice) {
            _burn(address(this), amount);
            emit StabilityAction(amount, false, currentPrice);
        }
    }
    
    // Community Governance
    
    /**
     * @dev Create a governance proposal
     */
    function createProposal(string memory description) external returns (uint256) {
        if (!governanceEnabled) revert InvalidProposal();
        if (balanceOf(msg.sender) < (totalSupply() * 1) / 100) revert InvalidProposal(); // Need 1% of supply
        
        uint256 proposalId = ++proposalCount;
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
        
        uint256 weight = balanceOf(msg.sender);
        proposal.hasVoted[msg.sender] = true;
        
        if (support) {
            proposal.votesFor += weight;
        } else {
            proposal.votesAgainst += weight;
        }
        
        emit VoteCast(proposalId, msg.sender, support, weight);
    }
    
    /**
     * @dev Execute a passed proposal
     */
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        if (!proposal.active) revert ProposalNotActive();
        if (block.timestamp < proposal.endTime) revert ProposalNotActive();
        if (proposal.executed) revert InvalidProposal();
        
        uint256 quorum = (totalSupply() * QUORUM_PERCENTAGE) / 100;
        if (proposal.votesFor + proposal.votesAgainst < quorum) revert QuorumNotReached();
        if (proposal.votesFor <= proposal.votesAgainst) revert InvalidProposal();
        
        proposal.executed = true;
        proposal.active = false;
        
        emit ProposalExecuted(proposalId);
    }
    
    // Admin Functions
    
    /**
     * @dev Update max transfer amount
     */
    function updateMaxTransferAmount(uint256 newAmount) external onlyOwner {
        uint256 oldAmount = maxTransferAmount;
        maxTransferAmount = newAmount;
        emit MaxTransferAmountUpdated(oldAmount, newAmount);
    }
    
    /**
     * @dev Toggle transfer limits
     */
    function toggleTransferLimits() external onlyOwner {
        transferLimitsEnabled = !transferLimitsEnabled;
    }
    
    /**
     * @dev Add/remove address from whitelist
     */
    function setWhitelisted(address account, bool whitelisted) external onlyOwner {
        isWhitelisted[account] = whitelisted;
    }
    
    /**
     * @dev Emergency pause
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Emergency unpause
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
    
    // View Functions
    
    /**
     * @dev Get available balance (total - locked)
     */
    function getAvailableBalance(address account) external view returns (uint256) {
        uint256 total = balanceOf(account);
        LockInfo memory lockInfo = lockedTokens[account];
        
        if (lockInfo.isLocked && block.timestamp < lockInfo.unlockTime) {
            return total > lockInfo.amount ? total - lockInfo.amount : 0;
        }
        return total;
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
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
            proposal.id,
            proposal.creator,
            proposal.description,
            proposal.votesFor,
            proposal.votesAgainst,
            proposal.endTime,
            proposal.executed,
            proposal.active
        );
    }
    
}
