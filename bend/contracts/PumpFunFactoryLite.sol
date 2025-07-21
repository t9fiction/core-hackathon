// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PumpFunToken.sol";
import "./PumpFunDEXManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IPumpFunGovernance {
    function createProposal(
        address token,
        string memory description,
        uint256 proposalType,
        uint256 proposedValue,
        address[] memory recipients,
        uint256[] memory amounts
    ) external returns (uint256);
}

contract PumpFunFactoryLite is Ownable, ReentrancyGuard, IERC721Receiver {
    // Custom Errors
    error PumpFunFactoryLite__InsufficientEtherFee(uint256 sent, uint256 required);
    error PumpFunFactoryLite__InvalidParameters();
    error PumpFunFactoryLite__NoEtherToWithdraw();
    error PumpFunFactoryLite__TransferFailed();
    error PumpFunFactoryLite__InvalidFeeAmount(uint256 fee);
    error PumpFunFactoryLite__EmptyStringParameter();
    error PumpFunFactoryLite__TotalSupplyTooLow();
    error PumpFunFactoryLite__TotalSupplyTooHigh(uint256 supply, uint256 maxSupply);
    error PumpFunFactoryLite__InsufficientLiquidityLockPeriod(uint256 provided, uint256 required);
    error PumpFunFactoryLite__InvalidLiquidityAmount();
    error PumpFunFactoryLite__TokenNotDeployedByFactory();
    error PumpFunFactoryLite__InvalidGovernanceAddress();
    error PumpFunFactoryLite__InvalidAirdropAddress();

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
    event GovernanceManagerUpdated(address indexed oldManager, address indexed newManager);
    event TokensGovernanceUpdated(address[] tokens, address indexed newGovernance);
    event AirdropManagerUpdated(address indexed oldManager, address indexed newManager);

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

    // Governance and Airdrop Integration
    address public governanceManager;
    address public airdropContract;

    // Tiered max supply limits
    uint256 public constant STANDARD_MAX_SUPPLY = 100000000; // 100M tokens
    uint256 public constant PREMIUM_MAX_SUPPLY = 500000000; // 500M tokens
    uint256 public constant ULTIMATE_MAX_SUPPLY = 1000000000; // 1B tokens

    uint256 public constant MIN_LIQUIDITY_LOCK_PERIOD_DAYS = 30; // Minimum lock period in days

    // Fee multipliers
    uint256 public constant STANDARD_FEE_MULTIPLIER = 1;
    uint256 public constant PREMIUM_FEE_MULTIPLIER = 3;
    uint256 public constant ULTIMATE_FEE_MULTIPLIER = 10;

    // Mappings
    mapping(address => address[]) public creatorTokens;
    mapping(address => bool) public isDeployedToken;
    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => LiquidityInfo) public liquidityInfo;
    mapping(address => uint256) public tokenLiquidityPoolBalance; // Tracks 20% liquidity allocation
    mapping(address => uint256) public tokenDexPoolBalance; // Tracks 40% DEX pool allocation
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
     * @dev Set the governance manager contract
     */
    function setGovernanceManager(address _governanceManager) external onlyOwner {
        if (_governanceManager == address(0)) revert PumpFunFactoryLite__InvalidGovernanceAddress();
        address oldManager = governanceManager;
        governanceManager = _governanceManager;
        emit GovernanceManagerUpdated(oldManager, _governanceManager);
    }

    /**
     * @dev Set the airdrop contract
     */
    function setAirdropManager(address _airdropContract) external onlyOwner {
        if (_airdropContract == address(0)) revert PumpFunFactoryLite__InvalidAirdropAddress();
        address oldManager = airdropContract;
        airdropContract = _airdropContract;
        emit AirdropManagerUpdated(oldManager, _airdropContract);
    }

    /**
     * @dev Update governance contract for existing tokens
     */
    function updateGovernanceForTokens(address[] calldata tokenAddresses) external onlyOwner {
        if (governanceManager == address(0)) revert PumpFunFactoryLite__InvalidGovernanceAddress();
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            address tokenAddress = tokenAddresses[i];
            if (!isDeployedToken[tokenAddress]) revert PumpFunFactoryLite__TokenNotDeployedByFactory();
            PumpFunToken(tokenAddress).setGovernanceContract(governanceManager);
        }
        emit TokensGovernanceUpdated(tokenAddresses, governanceManager);
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
        if (_percentage > 100) revert PumpFunFactoryLite__InvalidParameters();
        defaultLiquidityPercentage = _percentage;
    }

    /**
     * @dev Deploy a new sustainable meme token
     */
    function deployToken(string memory name, string memory symbol, uint256 totalSupply, uint256 liquidityLockPeriodDays)
        external
        payable
        nonReentrant
        returns (address tokenAddress)
    {
        _validateTokenParameters(name, symbol, totalSupply, liquidityLockPeriodDays);
        uint256 requiredFee = _calculateRequiredFee(totalSupply);
        if (msg.value < requiredFee) revert PumpFunFactoryLite__InsufficientEtherFee(msg.value, requiredFee);
        if (msg.value > requiredFee) payable(msg.sender).transfer(msg.value - requiredFee);

        // Deploy token
        PumpFunToken token = new PumpFunToken(name, symbol, totalSupply, msg.sender, address(this));
        tokenAddress = address(token);

        if (governanceManager != address(0)) {
            PumpFunToken(tokenAddress).setGovernanceContract(governanceManager);
        }

        // Initialize allocation balances
        uint256 initialSupply = totalSupply * 10 ** 18; // Assuming 18 decimals
        tokenLiquidityPoolBalance[tokenAddress] = (initialSupply * 20) / 100; // 20% for liquidity
        tokenDexPoolBalance[tokenAddress] = (initialSupply * 40) / 100; // 40% for DEX

        tokenInfo[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            deploymentTime: block.timestamp,
            liquidityLockPeriodDays: liquidityLockPeriodDays
        });

        creatorTokens[msg.sender].push(tokenAddress);
        isDeployedToken[tokenAddress] = true;
        allDeployedTokens.push(tokenAddress);
        totalTokensDeployed++;
        totalFeesCollected += msg.value;

        emit TokenDeployed(name, symbol, tokenAddress, totalSupply, msg.sender, liquidityLockPeriodDays);
        return tokenAddress;
    }

    /**
     * @dev Add liquidity and lock it
     */
    function addAndLockLiquidity(address tokenAddress, uint256 tokenAmount) external payable nonReentrant {
        if (!isDeployedToken[tokenAddress]) revert PumpFunFactoryLite__TokenNotDeployedByFactory();
        if (msg.value == 0 || tokenAmount == 0) revert PumpFunFactoryLite__InvalidLiquidityAmount();
        if (tokenLiquidityPoolBalance[tokenAddress] < tokenAmount) {
            revert PumpFunFactoryLite__InvalidLiquidityAmount();
        }
        TokenInfo storage info = tokenInfo[tokenAddress];
        if (info.creator != msg.sender) revert PumpFunFactoryLite__InvalidParameters();

        // Deduct from liquidity pool balance in token contract
        PumpFunToken(tokenAddress).deductLiquidityPoolBalance(tokenAmount);
        IERC20(tokenAddress).transferFrom(tokenAddress, address(this), tokenAmount);

        // Update factory's tracking
        tokenLiquidityPoolBalance[tokenAddress] -= tokenAmount;

        uint256 lockPeriodSeconds = info.liquidityLockPeriodDays * 1 days;
        liquidityInfo[tokenAddress] = LiquidityInfo({
            ethAmount: msg.value,
            tokenAmount: tokenAmount,
            lockPeriod: lockPeriodSeconds,
            isLocked: true
        });

        PumpFunToken(tokenAddress).lockLiquidity(tokenAddress, tokenAmount, lockPeriodSeconds);
        emit LiquidityAdded(tokenAddress, msg.sender, msg.value, tokenAmount);
    }

    // In createDEXPool
    function createDEXPool(address tokenAddress, uint256 tokenAmount, uint24 fee) external payable nonReentrant {
        if (!isDeployedToken[tokenAddress]) revert PumpFunFactoryLite__TokenNotDeployedByFactory();
        if (address(dexManager) == address(0)) revert PumpFunFactoryLite__InvalidParameters();
        if (msg.value == 0 || tokenAmount == 0) revert PumpFunFactoryLite__InvalidLiquidityAmount();
        if (tokenDexPoolBalance[tokenAddress] < tokenAmount) {
            revert PumpFunFactoryLite__InvalidLiquidityAmount();
        }
        TokenInfo storage info = tokenInfo[tokenAddress];
        if (info.creator != msg.sender) revert PumpFunFactoryLite__InvalidParameters();

        // Deduct from DEX pool balance in token contract
        PumpFunToken(tokenAddress).deductDexPoolBalance(tokenAmount);
        IERC20(tokenAddress).transferFrom(tokenAddress, address(this), tokenAmount);

        // Update factory's tracking
        tokenDexPoolBalance[tokenAddress] -= tokenAmount;

        IERC20(tokenAddress).approve(address(dexManager), tokenAmount);
        dexManager.authorizeTokenFromFactory(tokenAddress);
        dexManager.createLiquidityPoolWithETH{value: msg.value}(tokenAddress, fee, tokenAmount);

        (,,,, bool isActive) = dexManager.getTokenStats(tokenAddress);
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
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert PumpFunFactoryLite__EmptyStringParameter();
        if (totalSupply < MIN_TOTAL_SUPPLY) revert PumpFunFactoryLite__TotalSupplyTooLow();
        if (totalSupply > ULTIMATE_MAX_SUPPLY) {
            revert PumpFunFactoryLite__TotalSupplyTooHigh(totalSupply, ULTIMATE_MAX_SUPPLY);
        }
        if (liquidityLockPeriodDays < MIN_LIQUIDITY_LOCK_PERIOD_DAYS) {
            revert PumpFunFactoryLite__InsufficientLiquidityLockPeriod(
                liquidityLockPeriodDays, MIN_LIQUIDITY_LOCK_PERIOD_DAYS
            );
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
        if (newFee > MAX_FEE) revert PumpFunFactoryLite__InvalidFeeAmount(newFee);
        uint256 oldFee = etherFee;
        etherFee = newFee;
        emit EtherFeeUpdated(oldFee, newFee);
    }

    /**
     * @dev Trigger anti-rug pull measures
     */
    function triggerAntiRugPull(address tokenAddress, string memory reason) external onlyOwner {
        if (!isDeployedToken[tokenAddress]) revert PumpFunFactoryLite__TokenNotDeployedByFactory();
        PumpFunToken(tokenAddress).emergencyPause();
        emit AntiRugPullTriggered(tokenAddress, tokenInfo[tokenAddress].creator, reason);
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
        if (balance == 0) revert PumpFunFactoryLite__NoEtherToWithdraw();
        (bool success,) = payable(owner()).call{value: balance}("");
        if (!success) revert PumpFunFactoryLite__TransferFailed();
        emit EtherWithdrawn(owner(), balance);
    }

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

    /**
     * @dev Get airdrop contract address
     */
    function getAirdropContract() external view returns (address) {
        return airdropContract;
    }

    receive() external payable {}
    fallback() external payable {}
}
