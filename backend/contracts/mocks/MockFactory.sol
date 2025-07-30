// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockFactory {
    address public airdropContract;
    
    // Mock pools mapping
    mapping(address => mapping(address => mapping(uint24 => address))) public pools;
    
    constructor(address _airdropContract) {
        airdropContract = _airdropContract;
    }
    
    function getAirdropContract() external view returns (address) {
        return airdropContract;
    }
    
    /**
     * @dev Mock implementation of getPool for testing
     * Returns a mock pool address (can be zero or a dummy address)
     */
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool) {
        // Order tokens correctly
        address token0 = tokenA < tokenB ? tokenA : tokenB;
        address token1 = tokenA < tokenB ? tokenB : tokenA;
        
        // Return mock pool address if set, otherwise return a dummy address
        pool = pools[token0][token1][fee];
        if (pool == address(0)) {
            // Return a dummy non-zero address to simulate pool existence
            return address(0x1234567890123456789012345678901234567890);
        }
        return pool;
    }
    
    /**
     * @dev Mock implementation of createPool for testing
     */
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool) {
        // Order tokens correctly
        address token0 = tokenA < tokenB ? tokenA : tokenB;
        address token1 = tokenA < tokenB ? tokenB : tokenA;
        
        // Create a dummy pool address
        pool = address(uint160(uint256(keccak256(abi.encodePacked(token0, token1, fee)))));
        pools[token0][token1][fee] = pool;
        
        return pool;
    }
    
    /**
     * @dev Set a mock pool address for testing
     */
    function setMockPool(address tokenA, address tokenB, uint24 fee, address pool) external {
        address token0 = tokenA < tokenB ? tokenA : tokenB;
        address token1 = tokenA < tokenB ? tokenB : tokenA;
        pools[token0][token1][fee] = pool;
    }
}
