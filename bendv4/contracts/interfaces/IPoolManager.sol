// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IHooks.sol";

/// @notice The PoolKey struct represents a unique pool identifier
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    IHooks hooks;
}

/// @notice Pool state information
struct PoolState {
    uint160 sqrtPriceX96;
    int24 tick;
    uint8 protocolFee;
    uint24 lpFee;
}

/// @notice Parameters for modifying liquidity
struct ModifyLiquidityParams {
    int24 tickLower;
    int24 tickUpper;
    int256 liquidityDelta;
}

/// @notice Parameters for swapping
struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

/// @notice Interface for the Uniswap V4 Pool Manager
interface IPoolManager {
    /// @notice Initialize a pool
    function initialize(PoolKey memory key, uint160 sqrtPriceX96, bytes calldata hookData) external returns (int24 tick);
    
    /// @notice Modify liquidity in a pool
    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes calldata hookData) external returns (int256 delta0, int256 delta1);
    
    /// @notice Swap tokens in a pool
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData) external returns (int256 delta0, int256 delta1);
    
    /// @notice Get pool state
    function getPoolState(PoolKey memory key) external view returns (PoolState memory state);
    
    /// @notice Check if a pool exists
    function poolExists(PoolKey memory key) external view returns (bool);
    
    /// @notice Get liquidity for a position
    function getPosition(PoolKey memory key, address owner, int24 tickLower, int24 tickUpper) external view returns (uint128 liquidity);
}
