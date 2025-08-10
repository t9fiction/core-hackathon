// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IQuoter.sol";

/**
 * @title QuoterMock
 * @dev Mock contract for Uniswap V3 Quoter functionality for testing
 */
contract QuoterMock is IQuoter {
    mapping(address => mapping(address => mapping(uint24 => uint256))) public mockPrices;
    bool public shouldRevert = false;

    /**
     * @dev Set mock price for a token pair
     */
    function setMockPrice(address tokenIn, address tokenOut, uint24 fee, uint256 price) external {
        mockPrices[tokenIn][tokenOut][fee] = price;
    }
    
    /**
     * @dev Set whether the quoter should revert (for testing error handling)
     */
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    /**
     * @dev Mock implementation of quoteExactInputSingle
     * Returns a mock price based on the ratio of input amount
     */
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 /*sqrtPriceLimitX96*/
    ) external view override returns (uint256 amountOut) {
        if (shouldRevert) {
            revert("Mock quoter revert");
        }
        
        uint256 mockPrice = mockPrices[tokenIn][tokenOut][fee];
        if (mockPrice == 0) {
            // Default mock price: 1 tokenIn = 2 tokenOut
            return amountIn * 2;
        }
        
        // Calculate based on mock price (price is in basis points, e.g., 20000 = 2.0x)
        return (amountIn * mockPrice) / 10000;
    }

    /**
     * @dev Mock implementation of quoteExactInput for multi-hop swaps
     */
    function quoteExactInput(bytes memory /*path*/, uint256 amountIn)
        external
        pure
        override
        returns (uint256 amountOut)
    {
        // Simple mock: return 1.5x the input amount
        return (amountIn * 15000) / 10000;
    }

    /**
     * @dev Mock implementation of quoteExactOutputSingle
     */
    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint160 /*sqrtPriceLimitX96*/
    ) external view override returns (uint256 amountIn) {
        if (shouldRevert) {
            revert("Mock quoter revert");
        }
        
        uint256 mockPrice = mockPrices[tokenIn][tokenOut][fee];
        if (mockPrice == 0) {
            // Default mock price: need 0.5 tokenIn for 1 tokenOut
            return amountOut / 2;
        }
        
        // Calculate based on mock price
        return (amountOut * 10000) / mockPrice;
    }

    /**
     * @dev Mock implementation of quoteExactOutput for multi-hop swaps
     */
    function quoteExactOutput(bytes memory /*path*/, uint256 amountOut)
        external
        pure
        override
        returns (uint256 amountIn)
    {
        // Simple mock: need 0.67x the output amount as input
        return (amountOut * 6700) / 10000;
    }
}
