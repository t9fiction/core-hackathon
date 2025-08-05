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

    // Events
    event TokenCreated(address indexed creator, uint256 totalSupply);

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
        
        // Mint ALL tokens to the creator/owner
        _mint(_creator, totalSupply);
        
        emit TokenCreated(_creator, totalSupply);
    }
}
