// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface for Uniswap V4 hooks
interface IHooks {
    /// @notice Hook called before pool initialization
    function beforeInitialize(address sender, bytes calldata key, uint160 sqrtPriceX96, bytes calldata hookData) external returns (bytes4);
    
    /// @notice Hook called after pool initialization
    function afterInitialize(address sender, bytes calldata key, uint160 sqrtPriceX96, int24 tick, bytes calldata hookData) external returns (bytes4);
    
    /// @notice Hook called before liquidity modification
    function beforeModifyLiquidity(address sender, bytes calldata key, bytes calldata params, bytes calldata hookData) external returns (bytes4);
    
    /// @notice Hook called after liquidity modification
    function afterModifyLiquidity(address sender, bytes calldata key, bytes calldata params, bytes calldata hookData) external returns (bytes4);
    
    /// @notice Hook called before swap
    function beforeSwap(address sender, bytes calldata key, bytes calldata params, bytes calldata hookData) external returns (bytes4);
    
    /// @notice Hook called after swap
    function afterSwap(address sender, bytes calldata key, bytes calldata params, int256 delta0, int256 delta1, bytes calldata hookData) external returns (bytes4);
}
