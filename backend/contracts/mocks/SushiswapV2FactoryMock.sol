// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SushiswapV2FactoryMock
 * @dev Mock implementation of SushiSwap V2 Factory for testing
 */
contract SushiswapV2FactoryMock {
    mapping(address => mapping(address => address)) public pairs;
    address[] public allPairs;
    
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);
    
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'ZERO_ADDRESS');
        require(pairs[token0][token1] == address(0), 'PAIR_EXISTS');
        
        // Create a mock pair contract
        MockPair mockPair = new MockPair(token0, token1);
        pair = address(mockPair);
        
        pairs[token0][token1] = pair;
        pairs[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
    
    function getPair(address tokenA, address tokenB) external view returns (address pair) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return pairs[token0][token1];
    }
    
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}

/**
 * @title MockPair
 * @dev Mock implementation of a SushiSwap V2 Pair for testing
 */
contract MockPair {
    address public token0;
    address public token1;
    
    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }
    
    // Mock functions that might be called during testing
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) {
        return (1000 * 10**18, 1000 * 10**18, uint32(block.timestamp));
    }
}
