// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IQuoter
 * @dev Interface for Uniswap V3 Quoter contract
 */
interface IQuoter {
    /**
     * @notice Returns the amount out received for a given exact input swap without executing the swap
     * @param tokenIn The token being swapped in
     * @param tokenOut The token being swapped out
     * @param fee The fee of the pool
     * @param amountIn The amount of tokenIn
     * @param sqrtPriceLimitX96 The price limit of the pool that cannot be exceeded by the swap
     * @return amountOut The amount of tokenOut that would be received
     */
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external view returns (uint256 amountOut);

    /**
     * @notice Returns the amount out received for a given exact input swap without executing the swap
     * @param path The path of the swap, i.e. each token pair and the pool fee
     * @param amountIn The amount of the first token to swap
     * @return amountOut The amount of the last token that would be received
     */
    function quoteExactInput(bytes memory path, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);

    /**
     * @notice Returns the amount in required for a given exact output swap without executing the swap
     * @param tokenIn The token being swapped in
     * @param tokenOut The token being swapped out
     * @param fee The fee of the pool
     * @param amountOut The amount of tokenOut
     * @param sqrtPriceLimitX96 The price limit of the pool that cannot be exceeded by the swap
     * @return amountIn The amount of tokenIn that would be required
     */
    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint160 sqrtPriceLimitX96
    ) external view returns (uint256 amountIn);

    /**
     * @notice Returns the amount in required for a given exact output swap without executing the swap
     * @param path The path of the swap, i.e. each token pair and the pool fee
     * @param amountOut The amount of the last token to receive
     * @return amountIn The amount of the first token that would be required
     */
    function quoteExactOutput(bytes memory path, uint256 amountOut)
        external
        view
        returns (uint256 amountIn);
}
