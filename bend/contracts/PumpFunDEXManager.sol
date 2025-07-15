// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IUniswapV3Factory.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./interfaces/IWETH.sol";

/**
 * @title PumpFunDEXManager
 * @dev Manages DEX integration for PumpFun tokens with automated liquidity provision using Uniswap V3
 */
contract PumpFunDEXManager is Ownable, ReentrancyGuard {
    // Custom Errors
    error InvalidTokenAddress();
    error InvalidAmount();
    error InsufficientLiquidity();
    error PairAlreadyExists();
    error SlippageExceeded();
    error DeadlineExpired();
    error UnauthorizedToken();
    error LiquidityLocked();

    // Modifiers
    modifier onlyFactory() {
        require(msg.sender == factory, "Caller is not the factory");
        _;
    }

    // Events
    event LiquidityPoolCreated(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );
    event LiquidityAdded(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed token0, address indexed token1, uint24 indexed fee, uint256 amount0, uint256 amount1
    );
    event TokenSwapped(
        address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut
    );
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);

    // Structs
    struct PoolInfo {
        uint256 tokenId;
        uint256 liquidity;
        uint256 lockExpiry;
        bool isActive;
        uint256 createdAt;
    }

    struct PriceInfo {
        uint256 price; // Price in base currency with 18 decimals
        uint256 lastUpdated;
        uint256 volume24h; // 24h trading volume
        uint256 marketCap; // Market cap in base currency
    }

    // State Variables
    ISwapRouter public immutable swapRouter;
    INonfungiblePositionManager public immutable positionManager;
    IUniswapV3Factory public immutable uniswapV3Factory;
    address public immutable WETH;
    address public factory;

    mapping(address => PoolInfo) public tokenPools;
    mapping(address => PriceInfo) public tokenPrices;
    mapping(address => bool) public authorizedTokens;

    uint256 public constant SLIPPAGE_TOLERANCE = 500; // 5% in basis points
    uint256 public constant PRICE_UPDATE_INTERVAL = 300; // 5 minutes
    uint256 public constant MIN_LIQUIDITY_ETH = 0.1 ether;

    constructor(address _swapRouter, address _positionManager, address _uniswapV3Factory, address _weth)
        Ownable(msg.sender)
    {
        if (
            _swapRouter == address(0) || _positionManager == address(0) || _uniswapV3Factory == address(0)
                || _weth == address(0)
        ) {
            revert InvalidTokenAddress();
        }
        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(_positionManager);
        uniswapV3Factory = IUniswapV3Factory(_uniswapV3Factory);
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
     * @dev Create initial liquidity pool for a token with ETH (automatically converts ETH to WETH)
     */
    function createLiquidityPoolWithETH(address token, uint24 fee, uint256 tokenAmount) external payable nonReentrant {
        if (!authorizedTokens[token]) revert UnauthorizedToken();
        if (tokenAmount == 0) revert InvalidAmount();
        if (msg.value == 0) revert InvalidAmount();
        if (tokenPools[token].isActive) revert PairAlreadyExists();

        // Convert ETH to WETH
        IWETH(WETH).deposit{value: msg.value}();

        // Transfer tokens from sender
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);

        // Determine token ordering (Uniswap V3 requires token0 < token1)
        address token0 = token < WETH ? token : WETH;
        address token1 = token < WETH ? WETH : token;
        uint256 amount0Desired = token < WETH ? tokenAmount : msg.value;
        uint256 amount1Desired = token < WETH ? msg.value : tokenAmount;

        // Create the liquidity pool
        _createLiquidityPool(token0, token1, fee, amount0Desired, amount1Desired, token);
    }

    /**
     * @dev Create initial liquidity pool for a token (based on working sample)
     */
    function createLiquidityPool(
        address token0,
        address token1,
        uint24 fee,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external nonReentrant {
        if (token0 == address(0) || token1 == address(0)) revert InvalidTokenAddress();
        if (!authorizedTokens[token0]) revert UnauthorizedToken();
        if (!authorizedTokens[token1]) revert UnauthorizedToken();
        if (amount0Desired == 0 || amount1Desired == 0) revert InvalidAmount();
        if (tokenPools[token0].isActive) revert PairAlreadyExists();

        // Transfer tokens from sender (only for non-ETH tokens)
        IERC20(token0).transferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).transferFrom(msg.sender, address(this), amount1Desired);

        // 🔁 Correct token ordering
        address _token0 = token0 < token1 ? token0 : token1;
        address _token1 = token0 < token1 ? token1 : token0;

        // Create the liquidity pool
        _createLiquidityPool(_token0, _token1, fee, amount0Desired, amount1Desired, _token0);
    }

    /**
     * @dev Internal function to create liquidity pool
     */
    function _createLiquidityPool(
        address token0,
        address token1,
        uint24 fee,
        uint256 amount0Desired,
        uint256 amount1Desired,
        address trackingToken
    ) internal {
        // Check if pool already exists
        address poolAddress = uniswapV3Factory.getPool(token0, token1, fee);

        // Create pool if it doesn't exist
        if (poolAddress == address(0)) {
            poolAddress = uniswapV3Factory.createPool(token0, token1, fee);

            // Initialize pool with 1:1 price ratio (can be adjusted)
            uint160 sqrtPriceX96 = _encodeSqrtRatioX96(1, 1);
            IUniswapV3Pool(poolAddress).initialize(sqrtPriceX96);
        }

        // Approve position manager to spend tokens
        IERC20(token0).approve(address(positionManager), amount0Desired);
        IERC20(token1).approve(address(positionManager), amount1Desired);

        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0;
        uint256 amount1;

        {
            // Get pool state
            IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);

            // Retrieve pool state
            uint160 sqrtPriceX96;
            int24 tick;
            (sqrtPriceX96, tick,,,,,) = pool.slot0();

            // Calculate tick spacing
            int24 tickSpacing = _getTickSpacing(fee);
            int24 tickLower = ((tick - tickSpacing * 2) / tickSpacing) * tickSpacing;
            int24 tickUpper = ((tick + tickSpacing * 2) / tickSpacing) * tickSpacing;

            // Mint new position using calculated ticks
            INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp + 300
            });

            (tokenId, liquidity, amount0, amount1) = positionManager.mint(params);
        }

        // Store pool information (use the tracking token, not necessarily token0)
        tokenPools[trackingToken] = PoolInfo({
            tokenId: tokenId,
            liquidity: liquidity,
            lockExpiry: block.timestamp + 30 days,
            isActive: true,
            createdAt: block.timestamp
        });

        _updateTokenPrice(trackingToken);
        emit LiquidityPoolCreated(token0, token1, fee, amount0, amount1, liquidity);
    }

    /**
     * @dev Internal function to update token price
     */
    function _updateTokenPrice(address token) internal {
        if (!tokenPools[token].isActive) return;

        // Simulate a simple price update logic here
        uint256 price = 1000 * 1e18; // Placeholder logic
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
     * @dev Add liquidity to existing pool
     */
    function addLiquidity(address token0, address token1, uint24 fee, uint256 tokenAmount0, uint256 tokenAmount1)
        external
        payable
        nonReentrant
    {
        if (!tokenPools[token0].isActive) revert PairAlreadyExists();
        if (tokenAmount0 == 0 || tokenAmount1 == 0) revert InvalidAmount();

        // Transfer tokens from sender
        IERC20(token0).transferFrom(msg.sender, address(this), tokenAmount0);
        IERC20(token1).transferFrom(msg.sender, address(this), tokenAmount1);

        // Approve position manager
        IERC20(token0).approve(address(positionManager), tokenAmount0);
        IERC20(token1).approve(address(positionManager), tokenAmount1);

        // Increase liquidity on the token position
        PoolInfo storage poolInfo = tokenPools[token0];
        INonfungiblePositionManager.IncreaseLiquidityParams memory increaseParams = INonfungiblePositionManager
            .IncreaseLiquidityParams({
            tokenId: poolInfo.tokenId,
            amount0Desired: tokenAmount0,
            amount1Desired: tokenAmount1,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp + 300
        });

        (uint128 liquidity, uint256 amount0, uint256 amount1) = positionManager.increaseLiquidity(increaseParams);

        _updateTokenPrice(token0);
        emit LiquidityAdded(token0, token1, fee, amount0, amount1, liquidity);
    }

    /**
     * @dev Swap exact ETH for tokens using V3
     */
    function swapExactETHForTokens(address tokenOut, uint24 fee, uint256 amountOutMinimum)
        external
        payable
        nonReentrant
    {
        if (!authorizedTokens[tokenOut]) revert UnauthorizedToken();
        if (msg.value == 0) revert InvalidAmount();

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: tokenOut,
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp + 300,
            amountIn: msg.value,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = swapRouter.exactInputSingle{value: msg.value}(params);

        _updateTokenPrice(tokenOut);
        tokenPrices[tokenOut].volume24h += msg.value;

        emit TokenSwapped(msg.sender, WETH, tokenOut, msg.value, amountOut);
    }

    /**
     * @dev Swap exact tokens for ETH using V3
     */
    function swapExactTokensForETH(address tokenIn, uint24 fee, uint256 amountIn, uint256 amountOutMinimum)
        external
        nonReentrant
    {
        if (!authorizedTokens[tokenIn]) revert UnauthorizedToken();
        if (amountIn == 0) revert InvalidAmount();

        // Transfer tokens from user
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Approve router to spend tokens
        IERC20(tokenIn).approve(address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: WETH,
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = swapRouter.exactInputSingle(params);

        _updateTokenPrice(tokenIn);
        tokenPrices[tokenIn].volume24h += amountOut;

        emit TokenSwapped(msg.sender, tokenIn, WETH, amountIn, amountOut);
    }

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
    function getTokenStats(address token)
        external
        view
        returns (uint256 price, uint256 marketCap, uint256 volume24h, uint256 liquidity, bool isActive)
    {
        PriceInfo memory priceInfo = tokenPrices[token];
        PoolInfo memory poolInfo = tokenPools[token];

        return (priceInfo.price, priceInfo.marketCap, priceInfo.volume24h, poolInfo.liquidity, poolInfo.isActive);
    }

    /**
     * @dev Withdraw any stuck ETH (emergency function)
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success,) = payable(owner()).call{value: balance}("");
            require(success, "ETH withdrawal failed");
        }
    }

    /**
     * @dev Withdraw any stuck tokens (emergency function)
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @dev Get pool address for a token pair
     */
    function getPoolAddress(address token0, address token1, uint24 fee) external view returns (address) {
        return uniswapV3Factory.getPool(token0, token1, fee);
    }

    /**
     * @dev Internal function to encode sqrt ratio
     */
    function _encodeSqrtRatioX96(uint256 amount1, uint256 amount0) internal pure returns (uint160) {
        uint256 numerator1 = amount1;
        uint256 numerator2 = amount0;
        uint256 ratio = (numerator1 * 2 ** 96) / numerator2;
        return uint160(_sqrt(ratio * 2 ** 96));
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

    /**
     * @dev Get tick spacing for fee tier
     */
    function _getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == 100) return 1; // 0.01%
        if (fee == 500) return 10; // 0.05%
        if (fee == 3000) return 60; // 0.3%
        if (fee == 10000) return 200; // 1%
        return 60; // Default to 0.3% spacing
    }

    // Receive function to accept ETH
    receive() external payable {}

    fallback() external payable {}
}
