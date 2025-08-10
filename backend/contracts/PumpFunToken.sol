// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PumpFunToken is ERC20, ERC20Burnable, Ownable {
    // Custom Errors
    error PumpFunToken__ZeroAddress();
    error PumpFunToken__ZeroAmount();
    error PumpFunToken__InvalidName();
    error PumpFunToken__InvalidSymbol();
    error PumpFunToken__TransferLimitExceeded(uint256 amount, uint256 limit);
    error PumpFunToken__HoldingLimitExceeded(uint256 balance, uint256 limit);

    // Events
    event TokenCreated(address indexed creator, uint256 totalSupply);
    
    // Anti-Rug Protection Constants
    uint256 public constant TRANSFER_LIMIT_PERCENT = 5; // 5% of total supply
    uint256 public constant HOLDING_LIMIT_PERCENT = 5;  // 5% of total supply
    
    // State Variables
    address public factoryAddress;

    constructor(
        string memory name, 
        string memory symbol, 
        uint256 _totalSupply, 
        address _creator
    )
        ERC20(name, symbol)
        Ownable(_creator)
    {
        if (bytes(name).length == 0) revert PumpFunToken__InvalidName();
        if (bytes(symbol).length == 0) revert PumpFunToken__InvalidSymbol();
        if (_totalSupply == 0) revert PumpFunToken__ZeroAmount();
        if (_creator == address(0)) revert PumpFunToken__ZeroAddress();

        uint256 totalSupply = _totalSupply * 10 ** decimals();
        
        // Store factory address (msg.sender is the factory)
        factoryAddress = msg.sender;
        
        // Mint ALL tokens to the creator/owner
        _mint(_creator, totalSupply);
        
        emit TokenCreated(_creator, totalSupply);
    }
    
    /**
     * @dev Override transfer to implement anti-rug protection
     */
    function _update(address from, address to, uint256 value) internal override {
        // Skip limits for minting/burning
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        
        // Skip limits for factory, owner, and transfers between them
        if (_isExemptFromLimits(from) || _isExemptFromLimits(to)) {
            super._update(from, to, value);
            return;
        }
        
        // Check transfer limit (5% of total supply)
        uint256 maxTransfer = (totalSupply() * TRANSFER_LIMIT_PERCENT) / 100;
        if (value > maxTransfer) {
            revert PumpFunToken__TransferLimitExceeded(value, maxTransfer);
        }
        
        // Check holding limit for recipient (5% of total supply)
        uint256 maxHolding = (totalSupply() * HOLDING_LIMIT_PERCENT) / 100;
        uint256 newBalance = balanceOf(to) + value;
        if (newBalance > maxHolding) {
            revert PumpFunToken__HoldingLimitExceeded(newBalance, maxHolding);
        }
        
        super._update(from, to, value);
    }
    
    /**
     * @dev Check if address is exempt from limits
     */
    function _isExemptFromLimits(address account) internal view returns (bool) {
        return account == owner() || account == factoryAddress;
    }
    
    /**
     * @dev Get current transfer limit
     */
    function getTransferLimit() external view returns (uint256) {
        return (totalSupply() * TRANSFER_LIMIT_PERCENT) / 100;
    }
    
    /**
     * @dev Get current holding limit
     */
    function getHoldingLimit() external view returns (uint256) {
        return (totalSupply() * HOLDING_LIMIT_PERCENT) / 100;
    }
}
