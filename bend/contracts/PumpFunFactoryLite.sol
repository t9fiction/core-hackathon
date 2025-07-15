// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PumpFunToken.sol";
import "./PumpFunDEXManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title PumpFunFactoryLite
 * @dev Lightweight Factory for deploying sustainable meme tokens with core anti-rug pull measures
 */
contract PumpFunFactoryLite is Ownable, ReentrancyGuard, IERC721Receiver {
    // Custom Errors
    error InsufficientEtherFee(uint256 sent, uint256 required);
    error InvalidTokenAddress();
    error InvalidParameters();
    error NoEtherToWithdraw();
    error TransferFailed();
    error InvalidFeeAmount(uint256 fee);
    error EmptyStringParameter();
    error TotalSupplyTooLow();
    error TotalSupplyTooHigh(uint256 supply, uint256 maxSupply);
    error InsufficientLiquidityLockPeriod(uint256 provided, uint256 required);
    error InvalidLiquidityAmount();

    // Events
    event TokenDeployed(
        string indexed name,
        string indexed symbol,
        address indexed tokenAddress,
        uint256 totalSupply,
        address creator,
        uint256 liquidityLockPeriodDays
    );
    event EtherFeeUpdated(uint256 oldFee, uint256 newFee);
    event EtherWithdrawn(address indexed owner, uint256 amount);
    event LiquidityAdded(address indexed token, address indexed creator, uint256 ethAmount, uint256 tokenAmount);
    event AntiRugPullTriggered(address indexed token, address indexed violator, string reason);
    event DEXPoolCreated(address indexed token, address indexed pair, uint256 tokenAmount, uint256 ethAmount);
    event DEXManagerUpdated(address indexed oldManager, address indexed newManager);

    // Structs
    struct TokenInfo {
        address tokenAddress;
        address creator;
        uint256 deploymentTime;
        uint256 liquidityLockPeriodDays;
    }

    struct LiquidityInfo {
        uint256 ethAmount;
        uint256 tokenAmount;
        uint256 lockPeriod;
        bool isLocked;
    }

    // State Variables
    uint256 public etherFee = 0.05 ether;
    uint256 public constant MAX_FEE = 1 ether;
    uint256 public constant MIN_TOTAL_SUPPLY = 1000;

    // DEX Integration
    PumpFunDEXManager public dexManager;
    bool public autoCreatePools = true;
    uint256 public defaultLiquidityPercentage = 80; // 80% of liquidity allocation goes to DEX

    // Tiered max supply limits for different token types
    uint256 public constant STANDARD_MAX_SUPPLY = 100000000; // 100M tokens (recommended)
    uint256 public constant PREMIUM_MAX_SUPPLY = 500000000; // 500M tokens (higher fee)
    uint256 public constant ULTIMATE_MAX_SUPPLY = 1000000000; // 1B tokens (highest fee)

    uint256 public constant MIN_LIQUIDITY_LOCK_PERIOD_DAYS = 30; // Minimum lock period in days

    // Fee multipliers based on supply tier
    uint256 public constant STANDARD_FEE_MULTIPLIER = 1; // 1x base fee
    uint256 public constant PREMIUM_FEE_MULTIPLIER = 3; // 3x base fee
    uint256 public constant ULTIMATE_FEE_MULTIPLIER = 10; // 10x base fee

    // Mappings
    mapping(address => address[]) public creatorTokens;
    mapping(address => bool) public isDeployedToken;
    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => LiquidityInfo) public liquidityInfo;
    address[] public allDeployedTokens;

    // Statistics
    uint256 public totalTokensDeployed;
    uint256 public totalFeesCollected;

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Set the DEX manager contract
     */
    function setDEXManager(address payable _dexManager) external onlyOwner {
        address oldManager = address(dexManager);
        dexManager = PumpFunDEXManager(_dexManager);
        emit DEXManagerUpdated(oldManager, _dexManager);
    }

    /**
     * @dev Toggle automatic pool creation
     */
    function setAutoCreatePools(bool _autoCreate) external onlyOwner {
        autoCreatePools = _autoCreate;
    }

    /**
     * @dev Set default liquidity percentage for DEX
     */
    function setDefaultLiquidityPercentage(uint256 _percentage) external onlyOwner {
        if (_percentage > 100) {
            revert InvalidParameters();
        }
        defaultLiquidityPercentage = _percentage;
    }

    /**
     * @dev Deploy a new sustainable meme token with enhanced features
     * @param liquidityLockPeriodDays - Lock period in days (minimum 30 days)
     */
    function deployToken(string memory name, string memory symbol, uint256 totalSupply, uint256 liquidityLockPeriodDays)
        external
        payable
        nonReentrant
    {
        // Input validation
        _validateTokenParameters(name, symbol, totalSupply, liquidityLockPeriodDays);

        // Calculate required fee based on supply tier
        uint256 requiredFee = _calculateRequiredFee(totalSupply);
        if (msg.value < requiredFee) {
            revert InsufficientEtherFee(msg.value, requiredFee);
        }
        if (msg.value > requiredFee) {
            payable(msg.sender).transfer(msg.value - requiredFee);
        }

        // Deploy new token
        PumpFunToken token = new PumpFunToken(name, symbol, totalSupply, msg.sender);
        address tokenAddress = address(token);

        // Store token information
        tokenInfo[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            deploymentTime: block.timestamp,
            liquidityLockPeriodDays: liquidityLockPeriodDays
        });

        // Update tracking
        creatorTokens[msg.sender].push(tokenAddress);
        isDeployedToken[tokenAddress] = true;
        allDeployedTokens.push(tokenAddress);
        totalTokensDeployed++;
        totalFeesCollected += msg.value;

        emit TokenDeployed(name, symbol, tokenAddress, totalSupply, msg.sender, liquidityLockPeriodDays);
    }

    /**
     * @dev Add liquidity and lock it to prevent rug pulls
     */
    function addAndLockLiquidity(address tokenAddress, uint256 tokenAmount) external payable nonReentrant {
        if (!isDeployedToken[tokenAddress]) revert InvalidTokenAddress();
        if (msg.value == 0) revert InvalidLiquidityAmount();
        if (tokenAmount == 0) revert InvalidLiquidityAmount();

        TokenInfo storage info = tokenInfo[tokenAddress];
        if (info.creator != msg.sender) revert InvalidParameters();

        // Transfer tokens from creator
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);

        // Convert days to seconds for token contract
        uint256 lockPeriodSeconds = info.liquidityLockPeriodDays * 1 days;

        // Store liquidity information
        liquidityInfo[tokenAddress] = LiquidityInfo({
            ethAmount: msg.value,
            tokenAmount: tokenAmount,
            lockPeriod: lockPeriodSeconds,
            isLocked: true
        });

        // Lock the liquidity in the token contract
        PumpFunToken(tokenAddress).lockLiquidity(tokenAddress, tokenAmount, lockPeriodSeconds);

        emit LiquidityAdded(tokenAddress, msg.sender, msg.value, tokenAmount);
    }

    /**
     * @dev Create DEX liquidity pool for a token (with ETH support)
     */
    function createDEXPool(address tokenAddress, uint256 tokenAmount, uint24 fee) external payable nonReentrant {
        if (!isDeployedToken[tokenAddress]) revert InvalidTokenAddress();
        if (address(dexManager) == address(0)) revert InvalidParameters();
        if (msg.value == 0) revert InvalidLiquidityAmount();
        if (tokenAmount == 0) revert InvalidLiquidityAmount();

        TokenInfo storage info = tokenInfo[tokenAddress];
        if (info.creator != msg.sender) revert InvalidParameters();

        // Transfer tokens from creator
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);

        // Approve DEX manager to spend tokens
        IERC20(tokenAddress).approve(address(dexManager), tokenAmount);

        // Authorize token in DEX manager
        dexManager.authorizeTokenFromFactory(tokenAddress);

        // Use the new ETH-compatible function that handles WETH conversion automatically
        dexManager.createLiquidityPoolWithETH{value: msg.value}(tokenAddress, fee, tokenAmount);

        // Get the token stats from DEX manager
        (,, uint256 volume24h, uint256 liquidity, bool isActive) = dexManager.getTokenStats(tokenAddress);
        if (isActive) {
            address wethToken = dexManager.WETH();
            emit DEXPoolCreated(tokenAddress, wethToken, tokenAmount, msg.value);
        }
    }

    /**
     * @dev Validate token deployment parameters
     */
    function _validateTokenParameters(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint256 liquidityLockPeriodDays
    ) internal pure {
        if (bytes(name).length == 0) revert EmptyStringParameter();
        if (bytes(symbol).length == 0) revert EmptyStringParameter();
        if (totalSupply < MIN_TOTAL_SUPPLY) revert TotalSupplyTooLow();
        if (totalSupply > ULTIMATE_MAX_SUPPLY) {
            revert TotalSupplyTooHigh(totalSupply, ULTIMATE_MAX_SUPPLY);
        }
        if (liquidityLockPeriodDays < MIN_LIQUIDITY_LOCK_PERIOD_DAYS) {
            revert InsufficientLiquidityLockPeriod(liquidityLockPeriodDays, MIN_LIQUIDITY_LOCK_PERIOD_DAYS);
        }
    }

    /**
     * @dev Calculate required fee based on supply tier
     */
    function _calculateRequiredFee(uint256 totalSupply) internal view returns (uint256) {
        if (totalSupply <= STANDARD_MAX_SUPPLY) {
            return etherFee * STANDARD_FEE_MULTIPLIER;
        } else if (totalSupply <= PREMIUM_MAX_SUPPLY) {
            return etherFee * PREMIUM_FEE_MULTIPLIER;
        } else {
            return etherFee * ULTIMATE_FEE_MULTIPLIER;
        }
    }

    /**
     * @dev Get supply tier for a given total supply
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
     * @dev Get required fee for a given supply
     */
    function getRequiredFee(uint256 totalSupply) external view returns (uint256) {
        return _calculateRequiredFee(totalSupply);
    }

    // Admin Functions

    /**
     * @dev Update deployment fee
     */
    function setEtherFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_FEE) revert InvalidFeeAmount(newFee);
        uint256 oldFee = etherFee;
        etherFee = newFee;
        emit EtherFeeUpdated(oldFee, newFee);
    }

    /**
     * @dev Emergency function to trigger anti-rug pull measures
     */
    function triggerAntiRugPull(address tokenAddress, string memory reason) external onlyOwner {
        if (!isDeployedToken[tokenAddress]) revert InvalidTokenAddress();

        PumpFunToken token = PumpFunToken(tokenAddress);
        token.emergencyPause();

        emit AntiRugPullTriggered(tokenAddress, tokenInfo[tokenAddress].creator, reason);
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;

        if (balance == 0) revert NoEtherToWithdraw();

        (bool success,) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();

        emit EtherWithdrawn(owner(), balance);
    }

    // View Functions

    /**
     * @dev Get token information
     */
    function getTokenInfo(address tokenAddress)
        external
        view
        returns (address creator, uint256 deploymentTime, uint256 liquidityLockPeriodDays)
    {
        TokenInfo memory info = tokenInfo[tokenAddress];
        return (info.creator, info.deploymentTime, info.liquidityLockPeriodDays);
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
     * @dev Get all tokens created by a creator
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

    // Receive function to accept ETH
    receive() external payable {
        // Allow contract to receive ETH for liquidity
    }

    fallback() external payable {
        // Allow contract to receive ETH
    }
}
