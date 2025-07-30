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
import "./interfaces/IQuoter.sol";

/**
 * @title PumpFunDEXManager
 * @dev Manages DEX integration for PumpFun tokens with automated liquidity provision using Uniswap V3
 */
contract PumpFunDEXManager is Ownable, ReentrancyGuard {
    // Custom Errors
    error PumpFunDEXManager__InvalidTokenAddress();
    error PumpFunDEXManager__InvalidAmount();
    error PumpFunDEXManager__InsufficientLiquidity();
    error PumpFunDEXManager__PairAlreadyExists();
    error PumpFunDEXManager__SlippageExceeded();
    error PumpFunDEXManager__DeadlineExpired();
    error PumpFunDEXManager__UnauthorizedToken();
    error PumpFunDEXManager__LiquidityLocked();
    error PumpFunDEXManager__InvalidFactoryAddress();
    error PumpFunDEXManager__InsufficientBalance(uint256 available, uint256 requested);
    error PumpFunDEXManager__InvalidPathLength();
    error PumpFunDEXManager__PathFeesLengthMismatch();
    error PumpFunDEXManager__TransferFailed();

    // Modifiers
    modifier onlyFactory() {
        if (msg.sender != factory) revert PumpFunDEXManager__InvalidFactoryAddress();
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
    IQuoter public immutable quoter;
    address public immutable WETH;
    address public factory;

    mapping(address => mapping(address => mapping(uint24 => PoolInfo))) public tokenPools;
    mapping(address => PriceInfo) public tokenPrices;
    mapping(address => bool) public authorizedTokens;

    uint256 public constant SLIPPAGE_TOLERANCE = 500; // 5% in basis points
    uint256 public constant PRICE_UPDATE_INTERVAL = 300; // 5 minutes
    uint256 public constant MIN_LIQUIDITY_ETH = 0.1 ether;

    constructor(
        address _swapRouter,
        address _positionManager,
        address _uniswapV3Factory,
        address _quoter,
        address _weth
    ) Ownable(msg.sender) {
        if (
            _swapRouter == address(0) || _positionManager == address(0) || _uniswapV3Factory == address(0)
                || _quoter == address(0) || _weth == address(0)
        ) {
            revert PumpFunDEXManager__InvalidTokenAddress();
        }
        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(_positionManager);
        uniswapV3Factory = IUniswapV3Factory(_uniswapV3Factory);
        quoter = IQuoter(_quoter);
        WETH = _weth;
    }

    /**
     * @dev Set the factory contract address (only owner)
     */
    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert PumpFunDEXManager__InvalidFactoryAddress();
        factory = _factory;
    }

    /**
     * @dev Authorize a PumpFun token for DEX operations (owner only)
     */
    function authorizeToken(address token) external onlyOwner {
        if (token == address(0)) revert PumpFunDEXManager__InvalidTokenAddress();
        authorizedTokens[token] = true;
    }

    /**
     * @dev Authorize a PumpFun token for DEX operations (factory only)
     */
    function authorizeTokenFromFactory(address token) external onlyFactory {
        if (token == address(0)) revert PumpFunDEXManager__InvalidTokenAddress();
        authorizedTokens[token] = true;
    }

    /**
     * @dev Create initial liquidity pool for a token with ETH - requires both ETH and token amounts
     */
    function createLiquidityPoolWithETH(address token, uint24 fee, uint256 tokenAmount) external payable nonReentrant {
        if (!authorizedTokens[token]) revert PumpFunDEXManager__UnauthorizedToken();
        if (msg.value < MIN_LIQUIDITY_ETH) revert PumpFunDEXManager__InvalidAmount();
        if (tokenAmount == 0) revert PumpFunDEXManager__InvalidAmount();

        address token0 = token < WETH ? token : WETH;
        address token1 = token < WETH ? WETH : token;
        if (tokenPools[token0][token1][fee].isActive) revert PumpFunDEXManager__PairAlreadyExists();

        uint256 ethAmount = msg.value;

        IWETH(WETH).deposit{value: ethAmount}();
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);

        _createLiquidityPoolWithProperMapping(token, WETH, fee, tokenAmount, ethAmount, token);
    }

    /**
     * @dev Create initial liquidity pool for a token - requires both token amounts
     */
    function createLiquidityPool(address tokenA, address tokenB, uint24 fee, uint256 amountA, uint256 amountB)
        external
        nonReentrant
    {
        if (tokenA == address(0) || tokenB == address(0)) revert PumpFunDEXManager__InvalidTokenAddress();
        if (!authorizedTokens[tokenA] && !authorizedTokens[tokenB]) revert PumpFunDEXManager__UnauthorizedToken();
        if (amountA == 0 || amountB == 0) revert PumpFunDEXManager__InvalidAmount();

        address token0 = tokenA < tokenB ? tokenA : tokenB;
        address token1 = tokenA < tokenB ? tokenB : tokenA;
        if (tokenPools[token0][token1][fee].isActive) revert PumpFunDEXManager__PairAlreadyExists();

        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        address trackingToken = authorizedTokens[tokenA] ? tokenA : tokenB;
        _createLiquidityPoolWithProperMapping(tokenA, tokenB, fee, amountA, amountB, trackingToken);
    }

    /**
     * @dev Internal function to create liquidity pool with proper token-amount mapping
     */
    function _createLiquidityPoolWithProperMapping(
        address tokenA,
        address tokenB,
        uint24 fee,
        uint256 amountA,
        uint256 amountB,
        address trackingToken
    ) internal {
        address token0 = tokenA < tokenB ? tokenA : tokenB;
        address token1 = tokenA < tokenB ? tokenB : tokenA;

        uint256 amount0Desired;
        uint256 amount1Desired;

        if (tokenA < tokenB) {
            amount0Desired = amountA;
            amount1Desired = amountB;
        } else {
            amount0Desired = amountB;
            amount1Desired = amountA;
        }

        address poolAddress = uniswapV3Factory.getPool(token0, token1, fee);

        if (poolAddress == address(0)) {
            poolAddress = uniswapV3Factory.createPool(token0, token1, fee);
            uint160 sqrtPriceX96 = _encodeSqrtRatioX96(amount1Desired, amount0Desired);
            IUniswapV3Pool(poolAddress).initialize(sqrtPriceX96);
        }

        IERC20(token0).approve(address(positionManager), amount0Desired);
        IERC20(token1).approve(address(positionManager), amount1Desired);

        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0;
        uint256 amount1;

        {
            IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
            uint160 sqrtPriceX96;
            int24 tick;
            (sqrtPriceX96, tick,,,,,) = pool.slot0();

            int24 tickSpacing = _getTickSpacing(fee);
            int24 tickLower = ((tick - tickSpacing * 2) / tickSpacing) * tickSpacing;
            int24 tickUpper = ((tick + tickSpacing * 2) / tickSpacing) * tickSpacing;

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

        tokenPools[token0][token1][fee] = PoolInfo({
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
        address poolAddress = uniswapV3Factory.getPool(token < WETH ? token : WETH, token < WETH ? WETH : token, 3000); // Example fee tier
        if (poolAddress == address(0)) return; // Handle non-existent pool
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        uint256 price = token < WETH
            ? (uint256(sqrtPriceX96) * uint256(sqrtPriceX96) * 1e18) >> 192
            : (1e18 << 192) / (uint256(sqrtPriceX96) * uint256(sqrtPriceX96));
        uint256 marketCap = price * IERC20(token).totalSupply() / 1e18;
        tokenPrices[token] = PriceInfo({
            price: price,
            lastUpdated: block.timestamp,
            volume24h: tokenPrices[token].volume24h,
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
        address orderedToken0 = token0 < token1 ? token0 : token1;
        address orderedToken1 = token0 < token1 ? token1 : token0;
        if (!tokenPools[orderedToken0][orderedToken1][fee].isActive) revert PumpFunDEXManager__PairAlreadyExists();
        if (tokenAmount0 == 0 || tokenAmount1 == 0) revert PumpFunDEXManager__InvalidAmount();

        IERC20(token0).transferFrom(msg.sender, address(this), tokenAmount0);
        IERC20(token1).transferFrom(msg.sender, address(this), tokenAmount1);

        IERC20(token0).approve(address(positionManager), tokenAmount0);
        IERC20(token1).approve(address(positionManager), tokenAmount1);

        PoolInfo storage poolInfo = tokenPools[orderedToken0][orderedToken1][fee];
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
     * @dev Swap exact ETH for tokens using V3 with automatic slippage protection
     */
    function swapExactETHForTokens(address tokenOut, uint24 fee) external payable nonReentrant {
        if (!authorizedTokens[tokenOut]) revert PumpFunDEXManager__UnauthorizedToken();
        if (msg.value < MIN_LIQUIDITY_ETH) revert PumpFunDEXManager__InvalidAmount();

        bool isWETHLower = WETH < tokenOut;
        address token0 = isWETHLower ? WETH : tokenOut;
        address token1 = isWETHLower ? tokenOut : WETH;

        uint256 expectedAmountOut;
        try quoter.quoteExactInputSingle(WETH, tokenOut, fee, msg.value, 0) returns (uint256 quote) {
            expectedAmountOut = quote;
        } catch {
            revert PumpFunDEXManager__InsufficientLiquidity();
        }

        uint256 amountOutMinimum = (expectedAmountOut * (10000 - SLIPPAGE_TOLERANCE)) / 10000;

        IWETH(WETH).deposit{value: msg.value}();
        IERC20(WETH).approve(address(swapRouter), msg.value);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: tokenOut,
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp + 300,
            amountIn: msg.value,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0 // TODO: Consider adding price impact protection
        });

        uint256 amountOut = swapRouter.exactInputSingle{value: msg.value}(params);

        _updateTokenPrice(tokenOut);
        tokenPrices[tokenOut].volume24h += msg.value;

        emit TokenSwapped(msg.sender, WETH, tokenOut, msg.value, amountOut);
    }

    /**
     * @dev Swap exact ETH for tokens using V3 with custom slippage tolerance
     */
    function swapExactETHForTokensWithSlippage(address tokenOut, uint24 fee, uint256 slippageTolerance)
        external
        payable
        nonReentrant
    {
        if (!authorizedTokens[tokenOut]) revert PumpFunDEXManager__UnauthorizedToken();
        if (msg.value < MIN_LIQUIDITY_ETH) revert PumpFunDEXManager__InvalidAmount();
        if (slippageTolerance > 5000) revert PumpFunDEXManager__SlippageExceeded();

        bool isWETHLower = WETH < tokenOut;
        address token0 = isWETHLower ? WETH : tokenOut;
        address token1 = isWETHLower ? tokenOut : WETH;

        uint256 expectedAmountOut;
        try quoter.quoteExactInputSingle(WETH, tokenOut, fee, msg.value, 0) returns (uint256 quote) {
            expectedAmountOut = quote;
        } catch {
            revert PumpFunDEXManager__InsufficientLiquidity();
        }

        uint256 amountOutMinimum = (expectedAmountOut * (10000 - slippageTolerance)) / 10000;

        IWETH(WETH).deposit{value: msg.value}();
        IERC20(WETH).approve(address(swapRouter), msg.value);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: tokenOut,
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp + 300,
            amountIn: msg.value,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0 // TODO: Consider adding price impact protection
        });

        uint256 amountOut = swapRouter.exactInputSingle{value: msg.value}(params);

        _updateTokenPrice(tokenOut);
        tokenPrices[tokenOut].volume24h += msg.value;

        emit TokenSwapped(msg.sender, WETH, tokenOut, msg.value, amountOut);
    }

    /**
     * @dev Swap exact tokens for ETH using V3 with automatic slippage protection
     */
    function swapExactTokensForETH(address tokenIn, uint24 fee, uint256 amountIn) external nonReentrant {
        if (!authorizedTokens[tokenIn]) revert PumpFunDEXManager__UnauthorizedToken();
        if (amountIn == 0) revert PumpFunDEXManager__InvalidAmount();

        bool isTokenInLower = tokenIn < WETH;
        address token0 = isTokenInLower ? tokenIn : WETH;
        address token1 = isTokenInLower ? WETH : tokenIn;

        uint256 expectedAmountOut;
        try quoter.quoteExactInputSingle(tokenIn, WETH, fee, amountIn, 0) returns (uint256 quote) {
            expectedAmountOut = quote;
        } catch {
            revert PumpFunDEXManager__InsufficientLiquidity();
        }

        uint256 amountOutMinimum = (expectedAmountOut * (10000 - SLIPPAGE_TOLERANCE)) / 10000;

        if (IERC20(tokenIn).balanceOf(address(this)) < amountIn) {
            revert PumpFunDEXManager__InsufficientBalance(IERC20(tokenIn).balanceOf(address(this)), amountIn);
        }

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: WETH,
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0 // TODO: Consider adding price impact protection
        });

        uint256 amountOut = swapRouter.exactInputSingle(params);

        _updateTokenPrice(tokenIn);
        tokenPrices[tokenIn].volume24h += amountOut;

        emit TokenSwapped(msg.sender, tokenIn, WETH, amountIn, amountOut);
    }

    /**
     * @dev Swap exact tokens for ETH using V3 with custom slippage tolerance
     */
    function swapExactTokensForETHWithSlippage(address tokenIn, uint24 fee, uint256 amountIn, uint256 slippageTolerance)
        external
        nonReentrant
    {
        if (!authorizedTokens[tokenIn]) revert PumpFunDEXManager__UnauthorizedToken();
        if (amountIn == 0) revert PumpFunDEXManager__InvalidAmount();
        if (slippageTolerance > 5000) revert PumpFunDEXManager__SlippageExceeded();

        bool isTokenInLower = tokenIn < WETH;
        address token0 = isTokenInLower ? tokenIn : WETH;
        address token1 = isTokenInLower ? WETH : tokenIn;

        uint256 expectedAmountOut;
        try quoter.quoteExactInputSingle(tokenIn, WETH, fee, amountIn, 0) returns (uint256 quote) {
            expectedAmountOut = quote;
        } catch {
            revert PumpFunDEXManager__InsufficientLiquidity();
        }

        uint256 amountOutMinimum = (expectedAmountOut * (10000 - slippageTolerance)) / 10000;

        if (IERC20(tokenIn).balanceOf(address(this)) < amountIn) {
            revert PumpFunDEXManager__InsufficientBalance(IERC20(tokenIn).balanceOf(address(this)), amountIn);
        }

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: WETH,
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0 // TODO: Consider adding price impact protection
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
        // TODO: Implement actual liquidity calculation by iterating through tokenPools
        return (priceInfo.price, priceInfo.marketCap, priceInfo.volume24h, 0, false);
    }

    /**
     * @dev Get pool information for a specific token pair and fee
     */
    function getPoolInfo(address token0, address token1, uint24 fee)
        external
        view
        returns (uint256 tokenId, uint256 liquidity, uint256 lockExpiry, bool isActive, uint256 createdAt)
    {
        address orderedToken0 = token0 < token1 ? token0 : token1;
        address orderedToken1 = token0 < token1 ? token1 : token0;
        PoolInfo memory poolInfo = tokenPools[orderedToken0][orderedToken1][fee];
        return (poolInfo.tokenId, poolInfo.liquidity, poolInfo.lockExpiry, poolInfo.isActive, poolInfo.createdAt);
    }

    /**
     * @dev Withdraw any stuck ETH (emergency function)
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert PumpFunDEXManager__InvalidAmount();
        (bool success,) = payable(owner()).call{value: balance}("");
        if (!success) revert PumpFunDEXManager__TransferFailed();
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
        address orderedToken0 = token0 < token1 ? token0 : token1;
        address orderedToken1 = token0 < token1 ? token1 : token0;
        return uniswapV3Factory.getPool(orderedToken0, orderedToken1, fee);
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

    /**
     * @dev Get expected output amounts for a swap
     * @param amountIn Input amount
     * @param path An array of token addresses (path) to exchange through
     * @param fees An array of pool fees corresponding to each hop in the path
     * @return amounts Array of output amounts at each step
     */
    function getAmountsOutMultiHop(uint256 amountIn, address[] calldata path, uint24[] calldata fees)
        external
        view
        returns (uint256[] memory amounts)
    {
        if (path.length < 2) revert PumpFunDEXManager__InvalidPathLength();
        if (path.length - 1 != fees.length) revert PumpFunDEXManager__PathFeesLengthMismatch();

        for (uint256 i = 0; i < path.length; i++) {
            if (!authorizedTokens[path[i]] && path[i] != WETH) {
                revert PumpFunDEXManager__UnauthorizedToken();
            }
        }

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn = path[i];
            address tokenOut = path[i + 1];
            bool isTokenInLower = tokenIn < tokenOut;
            address orderedToken0 = isTokenInLower ? tokenIn : tokenOut;
            address orderedToken1 = isTokenInLower ? tokenOut : tokenIn;

            address poolAddress = uniswapV3Factory.getPool(orderedToken0, orderedToken1, fees[i]);
            if (poolAddress == address(0)) {
                for (uint256 j = i + 1; j < path.length; j++) {
                    amounts[j] = 0;
                }
                return amounts;
            }

            try quoter.quoteExactInputSingle(tokenIn, tokenOut, fees[i], amounts[i], 0) returns (uint256 amountOut) {
                amounts[i + 1] = amountOut;
            } catch {
                for (uint256 j = i + 1; j < path.length; j++) {
                    amounts[j] = 0;
                }
                return amounts;
            }
        }
    }

    /**
     * @dev Get expected output amount for a simple swap (single hop)
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param fee Pool fee tier
     * @param amountIn Input amount
     * @return amountOut Expected output amount
     */
    function getAmountsOutSingleHop(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        if (tokenIn == address(0) || tokenOut == address(0)) revert PumpFunDEXManager__InvalidTokenAddress();
        if (amountIn == 0) revert PumpFunDEXManager__InvalidAmount();

        bool isTokenInLower = tokenIn < tokenOut;
        address orderedToken0 = isTokenInLower ? tokenIn : tokenOut;
        address orderedToken1 = isTokenInLower ? tokenOut : tokenIn;

        address poolAddress = uniswapV3Factory.getPool(orderedToken0, orderedToken1, fee);
        if (poolAddress == address(0)) {
            return 0;
        }

        try quoter.quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, 0) returns (uint256 quote) {
            return quote;
        } catch {
            return 0;
        }
    }

    // Receive function to accept ETH
    receive() external payable {}

    fallback() external payable {}
}
