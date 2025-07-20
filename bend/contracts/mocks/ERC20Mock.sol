// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC20Mock
 * @dev Mock ERC20 token for testing purposes
 */
contract ERC20Mock is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialBalance
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialBalance);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }

    // Mock functions for governance testing
    function setMaxTransferAmount(uint256 amount) external {
        // Mock implementation - just emit an event or do nothing
    }

    function setMaxHolding(uint256 amount) external {
        // Mock implementation - just emit an event or do nothing
    }

    function setTransferLimitsEnabled(bool enabled) external {
        // Mock implementation - just emit an event or do nothing
    }

    function transferAirdrop(address[] calldata recipients, uint256[] calldata amounts) external {
        require(recipients.length == amounts.length, "Array length mismatch");
        // Mock implementation - just check array lengths
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Invalid amount");
        }
    }
}
