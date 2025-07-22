// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockFactory {
    address public airdropContract;
    
    constructor(address _airdropContract) {
        airdropContract = _airdropContract;
    }
    
    function getAirdropContract() external view returns (address) {
        return airdropContract;
    }
}
