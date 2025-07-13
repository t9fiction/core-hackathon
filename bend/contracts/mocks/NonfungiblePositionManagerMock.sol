// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/INonfungiblePositionManager.sol";

/**
 * @title NonfungiblePositionManagerMock
 * @dev Mock NonfungiblePositionManager for testing purposes
 */
contract NonfungiblePositionManagerMock is INonfungiblePositionManager {
    address public override factory;
    address public override WETH9;
    
    uint256 private nextTokenId = 1;
    mapping(uint256 => Position) private _positions;
    
    struct Position {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }
    
    constructor(address _factory, address _weth) {
        factory = _factory;
        WETH9 = _weth;
    }
    
    function mint(MintParams calldata params)
        external
        payable
        override
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        tokenId = nextTokenId++;
        liquidity = uint128(params.amount0Desired + params.amount1Desired); // Simple mock calculation
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        
        // Store position
        _positions[tokenId] = Position({
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity
        });
        
        // Transfer tokens
        IERC20(params.token0).transferFrom(msg.sender, address(this), amount0);
        IERC20(params.token1).transferFrom(msg.sender, address(this), amount1);
    }
    
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        override
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        // For mock, we'll just return the desired amounts
        // In a real implementation, this would interact with the actual position
        liquidity = uint128(params.amount0Desired + params.amount1Desired); // Simple mock calculation
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        
        // Only update position if it exists
        if (params.tokenId > 0 && params.tokenId < nextTokenId) {
            Position storage position = _positions[params.tokenId];
            position.liquidity += liquidity;
            
            // Transfer tokens
            IERC20(position.token0).transferFrom(msg.sender, address(this), amount0);
            IERC20(position.token1).transferFrom(msg.sender, address(this), amount1);
        }
    }
    
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        override
        returns (uint256 amount0, uint256 amount1)
    {
        Position storage position = _positions[params.tokenId];
        
        // Simple mock calculation
        amount0 = params.liquidity / 2;
        amount1 = params.liquidity / 2;
        
        position.liquidity -= params.liquidity;
        
        // Transfer tokens back
        IERC20(position.token0).transfer(msg.sender, amount0);
        IERC20(position.token1).transfer(msg.sender, amount1);
    }
    
    function collect(CollectParams calldata params)
        external
        payable
        override
        returns (uint256 amount0, uint256 amount1)
    {
        // Mock implementation
        amount0 = params.amount0Max;
        amount1 = params.amount1Max;
    }
    
    function burn(uint256 tokenId) external payable override {
        delete _positions[tokenId];
    }
    
    function positions(uint256 tokenId)
        external
        view
        override
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        Position memory position = _positions[tokenId];
        
        return (
            0, // nonce
            address(0), // operator
            position.token0,
            position.token1,
            position.fee,
            position.tickLower,
            position.tickUpper,
            position.liquidity,
            0, // feeGrowthInside0LastX128
            0, // feeGrowthInside1LastX128
            0, // tokensOwed0
            0  // tokensOwed1
        );
    }
}
