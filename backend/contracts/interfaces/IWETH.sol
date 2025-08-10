// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWETH
 * @dev Interface for Wrapped Ether (WETH) token
 */
interface IWETH is IERC20 {
    /**
     * @dev Deposit ETH and receive WETH
     */
    function deposit() external payable;
    
    /**
     * @dev Withdraw WETH and receive ETH
     */
    function withdraw(uint256 wad) external;
}
