// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IQuoterV2.sol";

/**
 * @title QuoterV2Mock
 * @dev Mock contract for Uniswap V3 QuoterV2 functionality for testing
 */
contract QuoterV2Mock is IQuoterV2 {
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
    function quoteExactInputSingle(QuoteExactInputSingleParams memory params)
        external
        view
        override
        returns (
            uint256 amountOut,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        )
    {
        if (shouldRevert) {
            revert("Mock quoter revert");
        }
        
        uint256 mockPrice = mockPrices[params.tokenIn][params.tokenOut][params.fee];
        if (mockPrice == 0) {
            // Default mock price: 1 tokenIn = 2 tokenOut
            amountOut = params.amountIn * 2;
        } else {
            // Calculate based on mock price (price is in basis points, e.g., 20000 = 2.0x)
            amountOut = (params.amountIn * mockPrice) / 10000;
        }
        
        // Mock values for other return parameters
        sqrtPriceX96After = 79228162514264337593543950336; // Mock sqrt price
        initializedTicksCrossed = 1;
        gasEstimate = 100000;
    }

    /**
     * @dev Mock implementation of quoteExactInput for multi-hop swaps
     */
    function quoteExactInput(QuoteExactInputParams memory params)
        external
        pure
        override
        returns (
            uint256 amountOut,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate
        )
    {
        // Simple mock: return 1.5x the input amount
        amountOut = (params.amountIn * 15000) / 10000;
        
        // Mock arrays (single hop for simplicity)
        sqrtPriceX96AfterList = new uint160[](1);
        sqrtPriceX96AfterList[0] = 79228162514264337593543950336;
        
        initializedTicksCrossedList = new uint32[](1);
        initializedTicksCrossedList[0] = 1;
        
        gasEstimate = 150000;
    }

    /**
     * @dev Mock implementation of quoteExactOutputSingle
     */
    function quoteExactOutputSingle(QuoteExactOutputSingleParams memory params)
        external
        view
        override
        returns (
            uint256 amountIn,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        )
    {
        if (shouldRevert) {
            revert("Mock quoter revert");
        }
        
        uint256 mockPrice = mockPrices[params.tokenIn][params.tokenOut][params.fee];
        if (mockPrice == 0) {
            // Default mock price: need 0.5 tokenIn for 1 tokenOut
            amountIn = params.amountOut / 2;
        } else {
            // Calculate based on mock price
            amountIn = (params.amountOut * 10000) / mockPrice;
        }
        
        // Mock values for other return parameters
        sqrtPriceX96After = 79228162514264337593543950336;
        initializedTicksCrossed = 1;
        gasEstimate = 100000;
    }

    /**
     * @dev Mock implementation of quoteExactOutput for multi-hop swaps
     */
    function quoteExactOutput(QuoteExactOutputParams memory params)
        external
        pure
        override
        returns (
            uint256 amountIn,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate
        )
    {
        // Simple mock: need 0.67x the output amount as input
        amountIn = (params.amountOut * 6700) / 10000;
        
        // Mock arrays
        sqrtPriceX96AfterList = new uint160[](1);
        sqrtPriceX96AfterList[0] = 79228162514264337593543950336;
        
        initializedTicksCrossedList = new uint32[](1);
        initializedTicksCrossedList[0] = 1;
        
        gasEstimate = 150000;
    }
}
