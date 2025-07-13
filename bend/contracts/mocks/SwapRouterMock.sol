// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ISwapRouter.sol";

/**
 * @title SwapRouterMock
 * @dev Mock SwapRouter for testing purposes
 */
contract SwapRouterMock is ISwapRouter {
    address public WETH;
    
    constructor(address _weth) {
        WETH = _weth;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) 
        external 
        payable 
        override 
        returns (uint256 amountOut) 
    {
        // Mock implementation - simple 1:1 swap for testing
        amountOut = params.amountIn;
        
        if (params.tokenIn == WETH) {
            // ETH to token swap
            require(msg.value == params.amountIn, "Incorrect ETH amount");
            IERC20(params.tokenOut).transfer(params.recipient, amountOut);
        } else {
            // Token to ETH swap
            IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
            payable(params.recipient).transfer(amountOut);
        }
    }
    
    function exactInput(ExactInputParams calldata params) 
        external 
        payable 
        override 
        returns (uint256 amountOut) 
    {
        // Mock implementation
        amountOut = params.amountIn;
    }
    
    function exactOutputSingle(ExactOutputSingleParams calldata params) 
        external 
        payable 
        override 
        returns (uint256 amountIn) 
    {
        // Mock implementation
        amountIn = params.amountOut;
    }
    
    function exactOutput(ExactOutputParams calldata params) 
        external 
        payable 
        override 
        returns (uint256 amountIn) 
    {
        // Mock implementation
        amountIn = params.amountOut;
    }
    
    // Helper function to add tokens for testing
    function addTokens(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }
    
    receive() external payable {}
}
