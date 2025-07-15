// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPoolManager.sol";
import "./interfaces/IHooks.sol";
import "./interfaces/IWETH.sol";

/**
 * @title PumpFunDEXManager
 * @dev Manages DEX integration for PumpFun tokens with automated liquidity provision using Uniswap V4
 */
contract PumpFunDEXManager is Ownable, ReentrancyGuard {
    
    // Custom Errors
    error InvalidTokenAddress();
    error InvalidAmount();
    error InsufficientLiquidity();
    error PoolAlreadyExists();
    error SlippageExceeded();
    error DeadlineExpired();
    error UnauthorizedToken();
    error LiquidityLocked();
    error PoolNotInitialized();
    error InvalidFee();
    error InvalidTickSpacing();
    
    // Modifiers
    modifier onlyFactory() {
        require(msg.sender == factory, "Caller is not the factory");
        _;
    }

    // Events
    event PoolCreated(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        int24 tickSpacing,
        address hooks
    );
    event LiquidityAdded(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        int256 amount0,
        int256 amount1,
        int24 tickLower,
        int24 tickUpper
    );
    event LiquidityRemoved(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        int256 amount0,
        int256 amount1
    );
    event TokenSwapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        int256 amountIn,
        int256 amountOut
    );
    event PriceUpdated(
        address indexed token,
        uint256 price,
        uint256 timestamp
    );
    
    // Structs
    struct PoolInfo {
        PoolKey poolKey;
        uint128 liquidity;
        uint256 lockExpiry;
        bool isActive;
        uint256 createdAt;
        int24 tickLower;
        int24 tickUpper;
    }
    
    struct PriceInfo {
        uint256 price;          // Price in base currency with 18 decimals
        uint256 lastUpdated;
        uint256 volume24h;      // 24h trading volume
        uint256 marketCap;      // Market cap in base currency
    }
    
    // State Variables
    IPoolManager public immutable poolManager;
    address public immutable WETH;
    address public factory;
    
    mapping(address => PoolInfo) public tokenPools;
    mapping(address => PriceInfo) public tokenPrices;
    mapping(address => bool) public authorizedTokens;
    
    uint256 public constant SLIPPAGE_TOLERANCE = 500; // 5% in basis points
    uint256 public constant PRICE_UPDATE_INTERVAL = 300; // 5 minutes
    uint256 public constant MIN_LIQUIDITY_ETH = 0.1 ether;
    
    // Standard fee tiers for Uniswap V4
    uint24 public constant FEE_LOW = 100;      // 0.01%
    uint24 public constant FEE_MEDIUM = 500;   // 0.05%
    uint24 public constant FEE_HIGH = 3000;    // 0.3%
    uint24 public constant FEE_VERY_HIGH = 10000; // 1%
    
    constructor(address _poolManager, address _weth) Ownable(msg.sender) {
        if (_poolManager == address(0) || _weth == address(0)) {
            revert InvalidTokenAddress();
        }
        poolManager = IPoolManager(_poolManager);
        WETH = _weth;
    }
    
    /**
     * @dev Set the factory contract address (only owner)
     */
    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Invalid factory address");
        factory = _factory;
    }
    
    /**
     * @dev Authorize a PumpFun token for DEX operations (owner only)
     */
    function authorizeToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidTokenAddress();
        authorizedTokens[token] = true;
    }
    
    /**
     * @dev Authorize a PumpFun token for DEX operations (factory only)
     */
    function authorizeTokenFromFactory(address token) external onlyFactory {
        if (token == address(0)) revert InvalidTokenAddress();
        authorizedTokens[token] = true;
    }
    
    /**
     * @dev Create and initialize a liquidity pool with ETH (automatically converts ETH to WETH)
     */
    function createLiquidityPoolWithETH(
        address token,
        uint24 fee,
        uint256 tokenAmount
    ) external payable nonReentrant {
        if (!authorizedTokens[token]) revert UnauthorizedToken();
        if (tokenAmount == 0) revert InvalidAmount();
        if (msg.value == 0) revert InvalidAmount();
        if (tokenPools[token].isActive) revert PoolAlreadyExists();
        
        // Convert ETH to WETH
        IWETH(WETH).deposit{value: msg.value}();
        
        // Transfer tokens from sender
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);
        
        // Determine token ordering (Uniswap V4 requires currency0 < currency1)
        address currency0 = token < WETH ? token : WETH;
        address currency1 = token < WETH ? WETH : token;
        
        // Create the liquidity pool
        _createAndInitializePool(currency0, currency1, fee, tokenAmount, msg.value, token);
    }
    
    /**
     * @dev Create and initialize a liquidity pool
     */
    function createLiquidityPool(
        address token0,
        address token1,
        uint24 fee,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external payable nonReentrant {
        if (!authorizedTokens[token0]) revert UnauthorizedToken();
        if (amount0Desired == 0 || amount1Desired == 0) revert InvalidAmount();
        if (tokenPools[token0].isActive) revert PoolAlreadyExists();
        
        // Handle ETH conversion if one of the tokens is WETH and ETH is sent
        if (token1 == WETH && msg.value > 0) {
            IWETH(WETH).deposit{value: msg.value}();
            amount1Desired = msg.value;
        }
        
        // Transfer tokens from sender (only for non-ETH tokens)
        if (token0 != WETH || msg.value == 0) {
            IERC20(token0).transferFrom(msg.sender, address(this), amount0Desired);
        }
        if (token1 != WETH || msg.value == 0) {
            IERC20(token1).transferFrom(msg.sender, address(this), amount1Desired);
        }
        
        // Create the liquidity pool
        _createAndInitializePool(token0, token1, fee, amount0Desired, amount1Desired, token0);
    }
    
    /**
     * @dev Internal function to create and initialize a pool
     */
    function _createAndInitializePool(
        address currency0,
        address currency1,
        uint24 fee,
        uint256 amount0,
        uint256 amount1,
        address trackingToken
    ) internal {
        // Validate fee tier
        if (!_isValidFee(fee)) revert InvalidFee();
        
        // Get tick spacing for the fee tier
        int24 tickSpacing = _getTickSpacing(fee);
        
        // Create pool key (no hooks for simple pools)
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });
        
        // Check if pool exists
        if (poolManager.poolExists(key)) {
            revert PoolAlreadyExists();
        }
        
        // Initialize pool with 1:1 price ratio
        uint160 sqrtPriceX96 = _encodeSqrtRatioX96(amount1, amount0);
        int24 tick = poolManager.initialize(key, sqrtPriceX96, "");
        
        // Calculate tick range for full range liquidity
        int24 tickLower = ((tick - tickSpacing * 10) / tickSpacing) * tickSpacing;
        int24 tickUpper = ((tick + tickSpacing * 10) / tickSpacing) * tickSpacing;
        
        // Approve tokens for pool manager
        IERC20(currency0).approve(address(poolManager), amount0);
        IERC20(currency1).approve(address(poolManager), amount1);
        
        // Add liquidity to the pool
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int256(uint256(_calculateLiquidity(amount0, amount1, tick, tickLower, tickUpper)))
        });
        
        (int256 delta0, int256 delta1) = poolManager.modifyLiquidity(key, params, "");
        
        // Store pool information
        tokenPools[trackingToken] = PoolInfo({
            poolKey: key,
            liquidity: uint128(uint256(params.liquidityDelta)),
            lockExpiry: block.timestamp + 30 days,
            isActive: true,
            createdAt: block.timestamp,
            tickLower: tickLower,
            tickUpper: tickUpper
        });
        
        _updateTokenPrice(trackingToken);
        
        emit PoolCreated(currency0, currency1, fee, tickSpacing, address(key.hooks));
        emit LiquidityAdded(currency0, currency1, fee, delta0, delta1, tickLower, tickUpper);
    }
    
    /**
     * @dev Add liquidity to an existing pool
     */
    function addLiquidity(
        address token,
        uint256 tokenAmount0,
        uint256 tokenAmount1
    ) external payable nonReentrant {
        if (!tokenPools[token].isActive) revert PoolNotInitialized();
        if (tokenAmount0 == 0 || tokenAmount1 == 0) revert InvalidAmount();
        
        PoolInfo storage poolInfo = tokenPools[token];
        
        // Transfer tokens from sender
        IERC20(poolInfo.poolKey.currency0).transferFrom(msg.sender, address(this), tokenAmount0);
        IERC20(poolInfo.poolKey.currency1).transferFrom(msg.sender, address(this), tokenAmount1);
        
        // Approve tokens for pool manager
        IERC20(poolInfo.poolKey.currency0).approve(address(poolManager), tokenAmount0);
        IERC20(poolInfo.poolKey.currency1).approve(address(poolManager), tokenAmount1);
        
        // Add liquidity
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: poolInfo.tickLower,
            tickUpper: poolInfo.tickUpper,
            liquidityDelta: int256(uint256(_calculateLiquidity(tokenAmount0, tokenAmount1, 0, poolInfo.tickLower, poolInfo.tickUpper)))
        });
        
        (int256 delta0, int256 delta1) = poolManager.modifyLiquidity(poolInfo.poolKey, params, "");
        
        poolInfo.liquidity += uint128(uint256(params.liquidityDelta));
        
        _updateTokenPrice(token);
        
        emit LiquidityAdded(
            poolInfo.poolKey.currency0,
            poolInfo.poolKey.currency1,
            poolInfo.poolKey.fee,
            delta0,
            delta1,
            poolInfo.tickLower,
            poolInfo.tickUpper
        );
    }
    
    /**
     * @dev Swap exact ETH for tokens
     */
    function swapExactETHForTokens(
        address tokenOut,
        uint24 fee,
        uint256 amountOutMinimum
    ) external payable nonReentrant {
        if (!authorizedTokens[tokenOut]) revert UnauthorizedToken();
        if (msg.value == 0) revert InvalidAmount();
        
        // Convert ETH to WETH
        IWETH(WETH).deposit{value: msg.value}();
        
        // Determine token ordering
        address currency0 = tokenOut < WETH ? tokenOut : WETH;
        address currency1 = tokenOut < WETH ? WETH : tokenOut;
        bool zeroForOne = WETH == currency0;
        
        // Create pool key
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: _getTickSpacing(fee),
            hooks: IHooks(address(0))
        });
        
        // Approve WETH for pool manager
        IERC20(WETH).approve(address(poolManager), msg.value);
        
        // Swap parameters
        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: int256(msg.value),
            sqrtPriceLimitX96: 0 // No price limit
        });
        
        (int256 delta0, int256 delta1) = poolManager.swap(key, params, "");
        
        uint256 amountOut = uint256(zeroForOne ? -delta1 : -delta0);
        if (amountOut < amountOutMinimum) revert SlippageExceeded();
        
        // Transfer tokens to user
        IERC20(tokenOut).transfer(msg.sender, amountOut);
        
        _updateTokenPrice(tokenOut);
        tokenPrices[tokenOut].volume24h += msg.value;
        
        emit TokenSwapped(msg.sender, WETH, tokenOut, int256(msg.value), int256(amountOut));
    }
    
    /**
     * @dev Swap exact tokens for ETH
     */
    function swapExactTokensForETH(
        address tokenIn,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external nonReentrant {
        if (!authorizedTokens[tokenIn]) revert UnauthorizedToken();
        if (amountIn == 0) revert InvalidAmount();
        
        // Transfer tokens from user
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        // Determine token ordering
        address currency0 = tokenIn < WETH ? tokenIn : WETH;
        address currency1 = tokenIn < WETH ? WETH : tokenIn;
        bool zeroForOne = tokenIn == currency0;
        
        // Create pool key
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: _getTickSpacing(fee),
            hooks: IHooks(address(0))
        });
        
        // Approve token for pool manager
        IERC20(tokenIn).approve(address(poolManager), amountIn);
        
        // Swap parameters
        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: int256(amountIn),
            sqrtPriceLimitX96: 0 // No price limit
        });
        
        (int256 delta0, int256 delta1) = poolManager.swap(key, params, "");
        
        uint256 amountOut = uint256(zeroForOne ? -delta1 : -delta0);
        if (amountOut < amountOutMinimum) revert SlippageExceeded();
        
        // Convert WETH to ETH and transfer to user
        IWETH(WETH).withdraw(amountOut);
        payable(msg.sender).transfer(amountOut);
        
        _updateTokenPrice(tokenIn);
        tokenPrices[tokenIn].volume24h += amountOut;
        
        emit TokenSwapped(msg.sender, tokenIn, WETH, int256(amountIn), int256(amountOut));
    }
    
    /**
     * @dev Internal function to update token price
     */
    function _updateTokenPrice(address token) internal {
        if (!tokenPools[token].isActive) return;
        
        PoolInfo storage poolInfo = tokenPools[token];
        PoolState memory state = poolManager.getPoolState(poolInfo.poolKey);
        
        // Calculate price from sqrtPriceX96
        uint256 price = _calculatePrice(state.sqrtPriceX96, token, poolInfo.poolKey.currency0, poolInfo.poolKey.currency1);
        uint256 marketCap = price * IERC20(token).totalSupply();
        
        tokenPrices[token] = PriceInfo({
            price: price,
            lastUpdated: block.timestamp,
            volume24h: tokenPrices[token].volume24h, // Preserve existing volume
            marketCap: marketCap
        });
        
        emit PriceUpdated(token, price, block.timestamp);
    }
    
    /**
     * @dev Calculate price from sqrtPriceX96
     */
    function _calculatePrice(uint160 sqrtPriceX96, address token, address currency0, address currency1) internal pure returns (uint256) {
        // Simple price calculation - this would need more sophisticated implementation
        uint256 price = uint256(sqrtPriceX96) ** 2;
        
        // Adjust for token ordering
        if (token != currency0) {
            price = (1e36) / price; // Invert price
        }
        
        return price / (2**192); // Normalize from X96 format
    }
    
    /**
     * @dev Calculate liquidity for given amounts and tick range
     */
    function _calculateLiquidity(
        uint256 amount0,
        uint256 amount1,
        int24 tick,
        int24 tickLower,
        int24 tickUpper
    ) internal pure returns (uint128) {
        // Simplified liquidity calculation
        // In a real implementation, this would use the proper Uniswap V4 math
        return uint128((amount0 + amount1) / 2);
    }
    
    /**
     * @dev Get tick spacing for fee tier
     */
    function _getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == 100) return 1;          // 0.01%
        if (fee == 500) return 10;         // 0.05%
        if (fee == 3000) return 60;        // 0.3%
        if (fee == 10000) return 200;      // 1%
        return 60; // Default to 0.3% spacing
    }
    
    /**
     * @dev Check if fee is valid
     */
    function _isValidFee(uint24 fee) internal pure returns (bool) {
        return fee == 100 || fee == 500 || fee == 3000 || fee == 10000;
    }
    
    /**
     * @dev Internal function to encode sqrt ratio
     */
    function _encodeSqrtRatioX96(uint256 amount1, uint256 amount0) internal pure returns (uint160) {
        uint256 numerator1 = amount1;
        uint256 numerator2 = amount0;
        uint256 ratio = (numerator1 * 2**96) / numerator2;
        return uint160(_sqrt(ratio * 2**96));
    }
    
    /**
     * @dev Internal function to calculate square root
     */
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
    
    // View Functions
    
    /**
     * @dev Get current token price in base currency
     */
    function getTokenPrice(address token) external view returns (uint256 price, uint256 lastUpdated) {
        PriceInfo memory priceInfo = tokenPrices[token];
        return (priceInfo.price, priceInfo.lastUpdated);
    }
    
    /**
     * @dev Get comprehensive token statistics
     */
    function getTokenStats(address token) external view returns (
        uint256 price,
        uint256 marketCap,
        uint256 volume24h,
        uint256 liquidity,
        bool isActive
    ) {
        PriceInfo memory priceInfo = tokenPrices[token];
        PoolInfo memory poolInfo = tokenPools[token];
        
        return (
            priceInfo.price,
            priceInfo.marketCap,
            priceInfo.volume24h,
            poolInfo.liquidity,
            poolInfo.isActive
        );
    }
    
    /**
     * @dev Check if a pool exists for a token pair
     */
    function poolExists(address token0, address token1, uint24 fee) external view returns (bool) {
        PoolKey memory key = PoolKey({
            currency0: token0 < token1 ? token0 : token1,
            currency1: token0 < token1 ? token1 : token0,
            fee: fee,
            tickSpacing: _getTickSpacing(fee),
            hooks: IHooks(address(0))
        });
        
        return poolManager.poolExists(key);
    }
    
    /**
     * @dev Get pool state for a token pair
     */
    function getPoolState(address token0, address token1, uint24 fee) external view returns (PoolState memory) {
        PoolKey memory key = PoolKey({
            currency0: token0 < token1 ? token0 : token1,
            currency1: token0 < token1 ? token1 : token0,
            fee: fee,
            tickSpacing: _getTickSpacing(fee),
            hooks: IHooks(address(0))
        });
        
        return poolManager.getPoolState(key);
    }
    
    // Admin Functions
    
    /**
     * @dev Withdraw any stuck ETH (emergency function)
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner()).transfer(balance);
        }
    }
    
    /**
     * @dev Withdraw any stuck tokens (emergency function)
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    // Receive function to accept ETH
    receive() external payable {}
    
    fallback() external payable {}
}
