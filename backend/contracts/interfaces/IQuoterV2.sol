// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IQuoterV2
 * @dev Interface for Uniswap V3 QuoterV2 contract
 */
interface IQuoterV2 {
    /**
     * @notice Returns the amount out received for a given exact input swap without executing the swap
     * @param params The params for the quote, encoded as `QuoteExactInputSingleParams`
     * tokenIn The token being swapped in
     * tokenOut The token being swapped out
     * fee The fee of the pool
     * amountIn The amount of tokenIn
     * sqrtPriceLimitX96 The price limit of the pool that cannot be exceeded by the swap
     * @return amountOut The amount of tokenOut that would be received
     * @return sqrtPriceX96After The sqrt price of the pool after the swap
     * @return initializedTicksCrossed The number of initialized ticks that the swap crossed
     * @return gasEstimate The estimate of the gas that the swap consumes
     */
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountIn;
        uint160 sqrtPriceLimitX96;
    }

    function quoteExactInputSingle(QuoteExactInputSingleParams memory params)
        external
        view
        returns (
            uint256 amountOut,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        );

    /**
     * @notice Returns the amount out received for a given exact input swap without executing the swap
     * @param path The path of the swap, i.e. each token pair and the pool fee
     * @param amountIn The amount of the first token to swap
     * @return amountOut The amount of the last token that would be received
     * @return sqrtPriceX96AfterList List of the sqrt price of the pool after the swap for each hop
     * @return initializedTicksCrossedList List of the initialized ticks that the swap crossed for each hop
     * @return gasEstimate The estimate of the gas that the swap consumes
     */
    struct QuoteExactInputParams {
        bytes path;
        uint256 amountIn;
    }

    function quoteExactInput(QuoteExactInputParams memory params)
        external
        view
        returns (
            uint256 amountOut,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate
        );

    /**
     * @notice Returns the amount in required for a given exact output swap without executing the swap
     * @param params The params for the quote, encoded as `QuoteExactOutputSingleParams`
     * tokenIn The token being swapped in
     * tokenOut The token being swapped out
     * fee The fee of the pool
     * amountOut The amount of tokenOut
     * sqrtPriceLimitX96 The price limit of the pool that cannot be exceeded by the swap
     * @return amountIn The amount of tokenIn that would be required
     * @return sqrtPriceX96After The sqrt price of the pool after the swap
     * @return initializedTicksCrossed The number of initialized ticks that the swap crossed
     * @return gasEstimate The estimate of the gas that the swap consumes
     */
    struct QuoteExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountOut;
        uint160 sqrtPriceLimitX96;
    }

    function quoteExactOutputSingle(QuoteExactOutputSingleParams memory params)
        external
        view
        returns (
            uint256 amountIn,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        );

    /**
     * @notice Returns the amount in required for a given exact output swap without executing the swap
     * @param path The path of the swap, i.e. each token pair and the pool fee
     * @param amountOut The amount of the last token to receive
     * @return amountIn The amount of the first token that would be required
     * @return sqrtPriceX96AfterList List of the sqrt price of the pool after the swap for each hop
     * @return initializedTicksCrossedList List of the initialized ticks that the swap crossed for each hop
     * @return gasEstimate The estimate of the gas that the swap consumes
     */
    struct QuoteExactOutputParams {
        bytes path;
        uint256 amountOut;
    }

    function quoteExactOutput(QuoteExactOutputParams memory params)
        external
        view
        returns (
            uint256 amountIn,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate
        );
}
