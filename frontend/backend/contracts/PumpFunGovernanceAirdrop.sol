// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PumpFunGovernanceAirdrop is Ownable {
    // Custom Errors
    error ArraysLengthMismatch(uint256 recipientsLength, uint256 amountsLength);
    error AlreadyClaimed(address recipient);
    error InsufficientBalance(uint256 available, uint256 requested);
    error ZeroAmount();

    mapping(address => mapping(address => bool)) public claimed; // token => recipient => claimed

    event AirdropClaimed(address indexed token, address indexed recipient, uint256 amount);

    constructor(address _governanceContract) Ownable(_governanceContract) {
        if (_governanceContract == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
    }

    function executeAirdrop(address token, address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        if (recipients.length != amounts.length) {
            revert ArraysLengthMismatch(recipients.length, amounts.length);
        }
        if (token == address(0)) revert ZeroAmount();

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) revert ZeroAmount();
            totalAmount += amounts[i];
        }

        if (IERC20(token).balanceOf(address(this)) < totalAmount) {
            revert InsufficientBalance(IERC20(token).balanceOf(address(this)), totalAmount);
        }

        for (uint256 i = 0; i < recipients.length; i++) {
            if (claimed[token][recipients[i]]) {
                revert AlreadyClaimed(recipients[i]);
            }
            claimed[token][recipients[i]] = true;
            IERC20(token).transfer(recipients[i], amounts[i]);
            emit AirdropClaimed(token, recipients[i], amounts[i]);
        }
    }
}