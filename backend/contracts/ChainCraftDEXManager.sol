// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IWETH.sol";

/**
 * @title IRouteProcessor7
 * @dev Interface for the SushiSwap RouteProcessor7 contract
 */
interface IRouteProcessor7 {
    function processRoute(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOutQuote,
        address to,
        bytes memory route,
        bool takeSurplus,
        uint32 referralCode
    ) external payable returns (uint256 amountOut);
}

/**
 * @title ChainCraftDEXManager
 * @dev Manages DEX integration for ChainCraft tokens using SushiSwap's RouteProcessor7
 */
contract ChainCraftDEXManager is Ownable, ReentrancyGuard {
    // Custom Errors
    error ChainCraftDEXManager__InvalidTokenAddress();
    error ChainCraftDEXManager__InvalidAmount();
    error ChainCraftDEXManager__TransferFailed();
    error ChainCraftDEXManager__InvalidFactoryAddress();
    error ChainCraftDEXManager__UnauthorizedToken();

    // Modifiers
    modifier onlyFactory {
        if (msg.sender != factory) revert ChainCraftDEXManager__InvalidFactoryAddress();
        _;
    }

    // Events
    event TokenSwapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bytes route
    );

    // State Variables
    IRouteProcessor7 public immutable swapRouter;
    address public immutable WCORE;
    address public factory;

    mapping(address => bool) public authorizedTokens;

    constructor(
        address _swapRouter,
        address _wcore
    ) Ownable(msg.sender) {
        if (_swapRouter == address(0) || _wcore == address(0)) {
            revert ChainCraftDEXManager__InvalidTokenAddress();
        }
        swapRouter = IRouteProcessor7(_swapRouter);
        WCORE = _wcore;
    }

    /**
     * @dev Set the factory contract address (only owner)
     */
    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ChainCraftDEXManager__InvalidFactoryAddress();
        factory = _factory;
    }

    /**
     * @dev Authorize a ChainCraft token for DEX operations (owner only)
     */
    function authorizeToken(address token) external onlyOwner {
        if (token == address(0)) revert ChainCraftDEXManager__InvalidTokenAddress();
        authorizedTokens[token] = true;
    }

    /**
     * @dev Authorize a ChainCraft token for DEX operations (factory only)
     */
    function authorizeTokenFromFactory(address token) external onlyFactory {
        if (token == address(0)) revert ChainCraftDEXManager__InvalidTokenAddress();
        authorizedTokens[token] = true;
    }

    /**
     * @dev Swap tokens using SushiSwap's RouteProcessor7
     * @param tokenIn The address of the input token
     * @param tokenOut The address of the output token
     * @param amountIn The amount of the input token
     * @param route The route data generated off-chain by SushiSwap's routing API
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes calldata route
    ) external payable nonReentrant returns (uint256 amountOut) {
        if (!authorizedTokens[tokenIn] && tokenIn != WCORE) revert ChainCraftDEXManager__UnauthorizedToken();
        if (!authorizedTokens[tokenOut] && tokenOut != WCORE) revert ChainCraftDEXManager__UnauthorizedToken();
        if (amountIn == 0) revert ChainCraftDEXManager__InvalidAmount();

        if (tokenIn == WCORE) {
            // Handle ETH -> Token swap
            IWETH(WCORE).deposit{value: msg.value}();
            IERC20(WCORE).approve(address(swapRouter), amountIn);
        } else {
            // Handle Token -> ETH or Token -> Token swap
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenIn).approve(address(swapRouter), amountIn);
        }

        // For simplicity, we are not handling surplus or referral codes
        amountOut = swapRouter.processRoute(
            tokenIn,
            amountIn,
            tokenOut,
            0, // amountOutQuote - set to 0 to accept any amount
            msg.sender,
            route,
            false, // takeSurplus
            0 // referralCode
        );

        if (tokenOut == WCORE) {
            // If the output is WETH, withdraw it to ETH and send to the user
            IWETH(WCORE).withdraw(amountOut);
            (bool success, ) = payable(msg.sender).call{value: amountOut}("");
            if (!success) revert ChainCraftDEXManager__TransferFailed();
        }

        emit TokenSwapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut, route);
    }

    /**
     * @dev Swap ETH for tokens using SushiSwap's RouteProcessor7
     * @param tokenOut The address of the output token
     * @param route The route data generated off-chain by SushiSwap's routing API
     */
    function swapETHForTokens(
        address tokenOut,
        bytes calldata route
    ) external payable nonReentrant returns (uint256 amountOut) {
        if (!authorizedTokens[tokenOut]) revert ChainCraftDEXManager__UnauthorizedToken();
        if (msg.value == 0) revert ChainCraftDEXManager__InvalidAmount();

        // Convert ETH to WETH
        IWETH(WCORE).deposit{value: msg.value}();
        IERC20(WCORE).approve(address(swapRouter), msg.value);

        // Execute swap via RouteProcessor7
        amountOut = swapRouter.processRoute(
            WCORE,
            msg.value,
            tokenOut,
            0, // amountOutQuote - set to 0 to accept any amount
            msg.sender,
            route,
            false, // takeSurplus
            0 // referralCode
        );

        emit TokenSwapped(msg.sender, WCORE, tokenOut, msg.value, amountOut, route);
    }

    /**
     * @dev Swap tokens for ETH using SushiSwap's RouteProcessor7
     * @param tokenIn The address of the input token
     * @param amountIn The amount of the input token
     * @param route The route data generated off-chain by SushiSwap's routing API
     */
    function swapTokensForETH(
        address tokenIn,
        uint256 amountIn,
        bytes calldata route
    ) external nonReentrant returns (uint256 amountOut) {
        if (!authorizedTokens[tokenIn]) revert ChainCraftDEXManager__UnauthorizedToken();
        if (amountIn == 0) revert ChainCraftDEXManager__InvalidAmount();

        // Transfer tokens from user to contract
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(swapRouter), amountIn);

        // Execute swap via RouteProcessor7 - receive WETH
        amountOut = swapRouter.processRoute(
            tokenIn,
            amountIn,
            WCORE,
            0, // amountOutQuote - set to 0 to accept any amount
            address(this), // Receive WETH to this contract
            route,
            false, // takeSurplus
            0 // referralCode
        );

        // Convert WETH to ETH and send to user
        IWETH(WCORE).withdraw(amountOut);
        (bool success, ) = payable(msg.sender).call{value: amountOut}("");
        if (!success) revert ChainCraftDEXManager__TransferFailed();

        emit TokenSwapped(msg.sender, tokenIn, WCORE, amountIn, amountOut, route);
    }

    /**
     * @dev Emergency function to withdraw any stuck ETH (owner only)
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ChainCraftDEXManager__InvalidAmount();
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert ChainCraftDEXManager__TransferFailed();
    }

    /**
     * @dev Emergency function to withdraw any stuck tokens (owner only)
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    // Receive function to accept ETH
    receive() external payable {}

    fallback() external payable {}
}
