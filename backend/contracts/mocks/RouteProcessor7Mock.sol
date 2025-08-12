// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RouteProcessor7Mock
 * @dev Mock implementation of SushiSwap RouteProcessor7 for testing
 */
contract RouteProcessor7Mock {
    uint256 private mockAmountOut = 1000 * 10**18; // Default mock output amount
    
    event MockSwap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOutQuote,
        address to,
        bytes route
    );

    /**
     * @dev Set the mock amount that will be returned by processRoute
     */
    function setMockAmountOut(uint256 _amountOut) external {
        mockAmountOut = _amountOut;
    }

    /**
     * @dev Mock implementation of RouteProcessor7's processRoute function
     */
    function processRoute(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOutQuote,
        address to,
        bytes memory route,
        bool takeSurplus,
        uint32 referralCode
    ) external payable returns (uint256 amountOut) {
        // Emit event for testing
        emit MockSwap(tokenIn, amountIn, tokenOut, amountOutQuote, to, route);
        
        // For testing, we'll just return the mock amount
        // In a real scenario, this would perform the actual swap
        amountOut = mockAmountOut;
        
        // For testing, we'll mint tokens to the recipient if it's an ERC20 token
        // This simulates the swap output
        if (tokenOut != address(0)) {
            // For WETH/ETH swaps, we handle it specially
            if (tokenOut == address(this)) {
                // This is ETH, send ETH directly
                payable(to).transfer(amountOut);
            } else {
                // Try to transfer tokens to the recipient
                // In a real router, this would be the result of the swap
                try IERC20(tokenOut).transfer(to, amountOut) {
                    // Success
                } catch {
                    // If transfer fails, we'll try to handle it gracefully
                    // For testing purposes, we'll assume the swap worked
                }
            }
        }
        
        return amountOut;
    }

    /**
     * @dev Allow the mock to receive ETH
     */
    receive() external payable {}
    
    /**
     * @dev Allow withdrawal of ETH for testing
     */
    function withdrawETH(address to, uint256 amount) external {
        payable(to).transfer(amount);
    }
    
    /**
     * @dev Allow withdrawal of tokens for testing
     */
    function withdrawToken(address token, address to, uint256 amount) external {
        IERC20(token).transfer(to, amount);
    }
}
