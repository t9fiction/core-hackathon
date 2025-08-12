// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ChainCraftToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract ChainCraftFactoryLite is Ownable, ReentrancyGuard, IERC721Receiver {
    // Custom Errors
    error ChainCraftFactoryLite__InsufficientEtherFee(uint256 sent, uint256 required);
    error ChainCraftFactoryLite__InvalidParameters();
    error ChainCraftFactoryLite__NoEtherToWithdraw();
    error ChainCraftFactoryLite__TransferFailed();
    error ChainCraftFactoryLite__InvalidFeeAmount(uint256 fee);
    error ChainCraftFactoryLite__EmptyStringParameter();
    error ChainCraftFactoryLite__TotalSupplyTooLow();
    error ChainCraftFactoryLite__TotalSupplyTooHigh(uint256 supply, uint256 maxSupply);
    error ChainCraftFactoryLite__TokenNotDeployedByFactory();
    error ChainCraftFactoryLite__InvalidTokenAmount();
    error ChainCraftFactoryLite__OnlyTokenOwner();
    error ChainCraftFactoryLite__TokenAlreadyLocked();
    error ChainCraftFactoryLite__TokenNotLocked();
    error ChainCraftFactoryLite__LockNotExpired();
    error ChainCraftFactoryLite__InvalidLockDuration();
    error ChainCraftFactoryLite__InsufficientTokenBalance();
    error ChainCraftFactoryLite__NotTokenCreator();

    // Events
    event TokenDeployed(
        string indexed name,
        string indexed symbol,
        address indexed tokenAddress,
        uint256 totalSupply,
        address creator,
        bool hasAntiRugProtection
    );
    event EtherFeeUpdated(uint256 oldFee, uint256 newFee);
    event EtherWithdrawn(address indexed owner, uint256 amount);
    event TokensLocked(
        address indexed token,
        address indexed owner,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 lockDuration,
        uint256 unlockTime,
        string description
    );
    event TokensUnlocked(
        address indexed token,
        address indexed owner,
        uint256 tokenAmount,
        uint256 ethAmount
    );

    // Structs
    struct TokenInfo {
        address tokenAddress;
        address creator;
        uint256 deploymentTime;
    }

    struct TokenLock {
        address tokenAddress;
        address owner;
        uint256 tokenAmount;
        uint256 ethAmount;
        uint256 lockTime;
        uint256 unlockTime;
        uint256 lockDuration;
        string description;
        bool isActive;
    }

    // State Variables
    uint256 public etherFee = 0.05 ether; // Base fee is now 0.05 ETH
    uint256 public constant MAX_FEE = 1 ether;
    uint256 public constant MIN_TOTAL_SUPPLY = 1000;

    // Tiered max supply limits
    uint256 public constant STANDARD_MAX_SUPPLY = 100000000; // 100M tokens
    uint256 public constant PREMIUM_MAX_SUPPLY = 500000000; // 500M tokens
    uint256 public constant ULTIMATE_MAX_SUPPLY = 1000000000; // 1B tokens

    // Fee multipliers
    uint256 public constant STANDARD_FEE_MULTIPLIER = 1;  // 0.05 * 1 = 0.05 ETH
    uint256 public constant PREMIUM_FEE_MULTIPLIER = 5;   // 0.05 * 5 = 0.25 ETH
    uint256 public constant ULTIMATE_FEE_MULTIPLIER = 10; // 0.05 * 10 = 0.5 ETH

    // Token Lock constants
    uint256 public constant MIN_LOCK_DURATION = 1 days;
    uint256 public constant MAX_LOCK_DURATION = 365 days;

    // Mappings
    mapping(address => address[]) public creatorTokens;
    mapping(address => bool) public isDeployedToken;
    mapping(address => TokenInfo) public tokenInfo;
    address[] public allDeployedTokens;

    // Token Lock mappings
    mapping(address => TokenLock) public tokenLocks; // token => lock info
    mapping(address => bool) public isTokenLocked;

    // Statistics
    uint256 public totalTokensDeployed;
    uint256 public totalFeesCollected;

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Deploy a new simple token - all tokens minted to creator
     */
    function deployToken(
        string memory name, 
        string memory symbol, 
        uint256 totalSupply
    )
        external
        payable
        nonReentrant
        returns (address tokenAddress)
    {
        _validateTokenParameters(name, symbol, totalSupply);
        uint256 requiredFee = _calculateRequiredFee(totalSupply);
        if (msg.value < requiredFee) revert ChainCraftFactoryLite__InsufficientEtherFee(msg.value, requiredFee);
        if (msg.value > requiredFee) payable(msg.sender).transfer(msg.value - requiredFee);

        // Deploy token - all tokens minted to creator
        ChainCraftToken token = new ChainCraftToken(name, symbol, totalSupply, msg.sender);
        tokenAddress = address(token);

        tokenInfo[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            deploymentTime: block.timestamp
        });

        creatorTokens[msg.sender].push(tokenAddress);
        isDeployedToken[tokenAddress] = true;
        allDeployedTokens.push(tokenAddress);
        totalTokensDeployed++;
        totalFeesCollected += msg.value;

        emit TokenDeployed(name, symbol, tokenAddress, totalSupply, msg.sender, true);
        return tokenAddress;
    }

    /**
     * @dev Validate token deployment parameters
     */
    function _validateTokenParameters(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) internal pure {
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert ChainCraftFactoryLite__EmptyStringParameter();
        if (totalSupply < MIN_TOTAL_SUPPLY) revert ChainCraftFactoryLite__TotalSupplyTooLow();
        if (totalSupply > ULTIMATE_MAX_SUPPLY) {
            revert ChainCraftFactoryLite__TotalSupplyTooHigh(totalSupply, ULTIMATE_MAX_SUPPLY);
        }
    }

    /**
     * @dev Calculate required fee
     */
    function _calculateRequiredFee(uint256 totalSupply) internal view returns (uint256) {
        if (totalSupply <= STANDARD_MAX_SUPPLY) return etherFee * STANDARD_FEE_MULTIPLIER;
        else if (totalSupply <= PREMIUM_MAX_SUPPLY) return etherFee * PREMIUM_FEE_MULTIPLIER;
        else return etherFee * ULTIMATE_FEE_MULTIPLIER;
    }

    /**
     * @dev Get supply tier
     */
    function getSupplyTier(uint256 totalSupply)
        external
        pure
        returns (string memory tier, uint256 maxSupply, uint256 feeMultiplier)
    {
        if (totalSupply <= STANDARD_MAX_SUPPLY) {
            return ("Standard", STANDARD_MAX_SUPPLY, STANDARD_FEE_MULTIPLIER);
        } else if (totalSupply <= PREMIUM_MAX_SUPPLY) {
            return ("Premium", PREMIUM_MAX_SUPPLY, PREMIUM_FEE_MULTIPLIER);
        } else {
            return ("Ultimate", ULTIMATE_MAX_SUPPLY, ULTIMATE_FEE_MULTIPLIER);
        }
    }

    /**
     * @dev Get required fee
     */
    function getRequiredFee(uint256 totalSupply) external view returns (uint256) {
        return _calculateRequiredFee(totalSupply);
    }

    /**
     * @dev Update deployment fee
     */
    function setEtherFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_FEE) revert ChainCraftFactoryLite__InvalidFeeAmount(newFee);
        uint256 oldFee = etherFee;
        etherFee = newFee;
        emit EtherFeeUpdated(oldFee, newFee);
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ChainCraftFactoryLite__NoEtherToWithdraw();
        (bool success,) = payable(owner()).call{value: balance}("");
        if (!success) revert ChainCraftFactoryLite__TransferFailed();
        emit EtherWithdrawn(owner(), balance);
    }

    /**
     * @dev Get token information
     */
    function getTokenInfo(address tokenAddress)
        external
        view
        returns (address creator, uint256 deploymentTime)
    {
        TokenInfo memory info = tokenInfo[tokenAddress];
        return (info.creator, info.deploymentTime);
    }

    /**
     * @dev Get factory statistics
     */
    function getFactoryStats()
        external
        view
        returns (uint256 _totalTokensDeployed, uint256 _totalFeesCollected, uint256 _currentBalance)
    {
        return (totalTokensDeployed, totalFeesCollected, address(this).balance);
    }

    /**
     * @dev Get tokens by creator
     */
    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    /**
     * @dev Get all deployed tokens
     */
    function getAllDeployedTokens() external view returns (address[] memory) {
        return allDeployedTokens;
    }

    // Functions for backwards compatibility
    function getAirdropContract() external pure returns (address) {
        return address(0); // No airdrop contract in simplified version
    }

    /**
     * @dev Lock tokens with ETH collateral to build community trust
     * Only the token creator/owner can lock tokens
     */
    function lockTokens(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 lockDuration,
        string memory description
    ) external payable nonReentrant {
        // Validate inputs
        if (!isDeployedToken[tokenAddress]) revert ChainCraftFactoryLite__TokenNotDeployedByFactory();
        if (isTokenLocked[tokenAddress]) revert ChainCraftFactoryLite__TokenAlreadyLocked();
        if (tokenInfo[tokenAddress].creator != msg.sender) revert ChainCraftFactoryLite__OnlyTokenOwner();
        if (lockDuration < MIN_LOCK_DURATION || lockDuration > MAX_LOCK_DURATION) {
            revert ChainCraftFactoryLite__InvalidLockDuration();
        }
        if (tokenAmount == 0) revert ChainCraftFactoryLite__InvalidTokenAmount();
        if (msg.value == 0) revert ChainCraftFactoryLite__InvalidParameters();

        // Check token balance
        IERC20 token = IERC20(tokenAddress);
        if (token.balanceOf(msg.sender) < tokenAmount) revert ChainCraftFactoryLite__InsufficientTokenBalance();

        // Transfer tokens to this contract
        token.transferFrom(msg.sender, address(this), tokenAmount);

        // Create lock
        uint256 unlockTime = block.timestamp + lockDuration;
        tokenLocks[tokenAddress] = TokenLock({
            tokenAddress: tokenAddress,
            owner: msg.sender,
            tokenAmount: tokenAmount,
            ethAmount: msg.value,
            lockTime: block.timestamp,
            unlockTime: unlockTime,
            lockDuration: lockDuration,
            description: description,
            isActive: true
        });
        
        isTokenLocked[tokenAddress] = true;

        emit TokensLocked(
            tokenAddress,
            msg.sender,
            tokenAmount,
            msg.value,
            lockDuration,
            unlockTime,
            description
        );
    }

    /**
     * @dev Unlock tokens after lock period expires
     */
    function unlockTokens(address tokenAddress) external nonReentrant {
        if (!isTokenLocked[tokenAddress]) revert ChainCraftFactoryLite__TokenNotLocked();
        
        TokenLock storage lockInfo = tokenLocks[tokenAddress];
        if (lockInfo.owner != msg.sender) revert ChainCraftFactoryLite__OnlyTokenOwner();
        if (block.timestamp < lockInfo.unlockTime) revert ChainCraftFactoryLite__LockNotExpired();
        if (!lockInfo.isActive) revert ChainCraftFactoryLite__TokenNotLocked();

        // Transfer tokens back to owner
        IERC20(tokenAddress).transfer(msg.sender, lockInfo.tokenAmount);
        
        // Return ETH collateral
        (bool success,) = payable(msg.sender).call{value: lockInfo.ethAmount}("");
        if (!success) revert ChainCraftFactoryLite__TransferFailed();

        // Mark lock as inactive
        lockInfo.isActive = false;
        isTokenLocked[tokenAddress] = false;

        emit TokensUnlocked(
            tokenAddress,
            msg.sender,
            lockInfo.tokenAmount,
            lockInfo.ethAmount
        );
    }

    /**
     * @dev Get token lock information
     */
    function getTokenLock(address tokenAddress) external view returns (TokenLock memory) {
        return tokenLocks[tokenAddress];
    }

    /**
     * @dev Check if token is currently locked
     */
    function isTokenCurrentlyLocked(address tokenAddress) external view returns (bool) {
        if (!isTokenLocked[tokenAddress]) return false;
        TokenLock memory lockInfo = tokenLocks[tokenAddress];
        return lockInfo.isActive && block.timestamp < lockInfo.unlockTime;
    }

    /**
     * @dev Get time remaining until unlock (returns 0 if unlocked or expired)
     */
    function getTimeUntilUnlock(address tokenAddress) external view returns (uint256) {
        if (!isTokenLocked[tokenAddress]) return 0;
        TokenLock memory lockInfo = tokenLocks[tokenAddress];
        if (!lockInfo.isActive || block.timestamp >= lockInfo.unlockTime) return 0;
        return lockInfo.unlockTime - block.timestamp;
    }

    /**
     * @dev Get days remaining until unlock (returns 0 if unlocked or expired)
     */
    function getDaysUntilUnlock(address tokenAddress) external view returns (uint256) {
        uint256 timeRemaining = this.getTimeUntilUnlock(tokenAddress);
        return timeRemaining / 1 days;
    }

    // Receive ETH
    receive() external payable {}
    fallback() external payable {}
}
