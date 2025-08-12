// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChainCraftDEXManager
 * @dev Simplified DEX manager for ChainCraft tokens - token authorization only
 * Since we're using SushiSwap directly from the frontend, this contract only handles token authorization.
 */
contract ChainCraftDEXManager is Ownable {
    // Custom Errors
    error ChainCraftDEXManager__InvalidTokenAddress();
    error ChainCraftDEXManager__InvalidFactoryAddress();

    // Modifiers
    modifier onlyFactory {
        if (msg.sender != factory) revert ChainCraftDEXManager__InvalidFactoryAddress();
        _;
    }

    // Events
    event TokenAuthorized(
        address indexed token,
        address indexed authorizer
    );

    // State Variables
    address public factory;
    mapping(address => bool) public authorizedTokens;

    constructor() Ownable(msg.sender) {
        // Simplified constructor - no external dependencies
    }

    /**
     * @dev Set the factory contract address (only owner)
     */
    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ChainCraftDEXManager__InvalidFactoryAddress();
        factory = _factory;
    }

    /**
     * @dev Authorize a ChainCraft token for DEX operations (owner only)
     */
    function authorizeToken(address token) external onlyOwner {
        if (token == address(0)) revert ChainCraftDEXManager__InvalidTokenAddress();
        authorizedTokens[token] = true;
        emit TokenAuthorized(token, msg.sender);
    }

    /**
     * @dev Authorize a ChainCraft token for DEX operations (factory only)
     */
    function authorizeTokenFromFactory(address token) external onlyFactory {
        if (token == address(0)) revert ChainCraftDEXManager__InvalidTokenAddress();
        authorizedTokens[token] = true;
        emit TokenAuthorized(token, msg.sender);
    }

}
