# Manual Contract Verification Guide for Core DAO

## Current Status

The contracts are **deployed successfully** but the **Core DAO explorer verification API is experiencing connectivity issues**. The contracts are functional and verified on Sourcify, but need manual verification on the Core DAO explorer.

## Deployed Contract Addresses

| Contract | Address | Status |
|----------|---------|---------|
| ChainCraftGovernance | `0x023B0cbDc5f65AA8036efeb52A80e768b20E6Ac4` | ✅ Deployed, ⚠️ Needs verification |
| ChainCraftFactoryLite | `0xF38B30c45621e0D9575509C4a686B3BB9467d27D` | ✅ Deployed, ⚠️ Needs verification |
| ChainCraftToken | `0x7D292628c3D70316C760479F958331E25586A7d4` | ✅ Deployed, ⚠️ Needs verification |

## Manual Verification Instructions

### Step 1: Visit Core DAO Explorer

Go to each contract address on the Core DAO explorer:

1. **Governance**: https://scan.coredao.org/address/0x023B0cbDc5f65AA8036efeb52A80e768b20E6Ac4
2. **Factory**: https://scan.coredao.org/address/0xF38B30c45621e0D9575509C4a686B3BB9467d27D  
3. **Token**: https://scan.coredao.org/address/0x7D292628c3D70316C760479F958331E25586A7d4

### Step 2: Verify Each Contract

For each contract:

1. Click on the **"Contract"** tab
2. Click **"Verify and Publish"** 
3. Fill in the verification form:

#### ChainCraftGovernance
- **Contract Address**: `0x023B0cbDc5f65AA8036efeb52A80e768b20E6Ac4`
- **Compiler Type**: Solidity (Single file)
- **Compiler Version**: v0.8.24+commit.e11b9ed9
- **License**: MIT
- **Source Code**: Use `flattened/ChainCraftGovernance.sol`
- **Constructor Arguments**: None
- **Optimization**: Yes (200 runs)

#### ChainCraftFactoryLite  
- **Contract Address**: `0xF38B30c45621e0D9575509C4a686B3BB9467d27D`
- **Compiler Type**: Solidity (Single file)
- **Compiler Version**: v0.8.24+commit.e11b9ed9
- **License**: MIT
- **Source Code**: Use `flattened/ChainCraftFactoryLite.sol`
- **Constructor Arguments**: None
- **Optimization**: Yes (200 runs)

#### ChainCraftToken (Sample)
- **Contract Address**: `0x7D292628c3D70316C760479F958331E25586A7d4`
- **Compiler Type**: Solidity (Single file)  
- **Compiler Version**: v0.8.24+commit.e11b9ed9
- **License**: MIT
- **Source Code**: Use `flattened/ChainCraftToken.sol`
- **Constructor Arguments**: 
  ```
  000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000804e2c4bb1f403557acfbc2d25941cfa6c226313000000000000000000000000000000000000000000000000000000000000001743686169e4372616674205361e706c6520546f6b656e00000000000000000000000000000000000000000000000000000000000000000000000000000000044343535400000000000000000000000000000000000000000000000000000000
  ```
- **Optimization**: Yes (200 runs)

### Step 3: Alternative - Sourcify Verification

If Core DAO explorer verification continues to fail, note that **all contracts are successfully verified on Sourcify**:

- **Governance**: https://repo.sourcify.dev/contracts/full_match/1116/0x023B0cbDc5f65AA8036efeb52A80e768b20E6Ac4/
- **Factory**: https://repo.sourcify.dev/contracts/full_match/1116/0xF38B30c45621e0D9575509C4a686B3BB9467d27D/
- **Token**: https://repo.sourcify.dev/contracts/full_match/1116/0x7D292628c3D70316C760479F958331E25586A7d4/

Sourcify is a **decentralized verification service** that provides the same security guarantees as explorer verification.

## Troubleshooting

### If Automatic Verification Fails

You can retry the hardhat verification commands when Core DAO API is stable:

```bash
# Governance
npx hardhat verify --network core_mainnet 0x023B0cbDc5f65AA8036efeb52A80e768b20E6Ac4

# Factory  
npx hardhat verify --network core_mainnet 0xF38B30c45621e0D9575509C4a686B3BB9467d27D

# Token
npx hardhat verify --network core_mainnet 0x7D292628c3D70316C760479F958331E25586A7d4 "ChainCraft Sample Token" "CCST" 1000000 "0x804e2c4bB1f403557acFbC2D25941cfa6C226313"
```

### Constructor Arguments Encoding

If you need to manually encode constructor arguments for the token:

```javascript
const ethers = require('ethers');
const args = [
  "ChainCraft Sample Token",  // name
  "CCST",                    // symbol  
  1000000,                   // totalSupply
  "0x804e2c4bB1f403557acFbC2D25941cfa6C226313" // creator
];
const encoded = ethers.utils.defaultAbiCoder.encode(
  ["string", "string", "uint256", "address"], 
  args
);
console.log(encoded.slice(2)); // Remove 0x prefix
```

## Current Status Summary

✅ **All contracts deployed successfully**  
✅ **All contracts functional and tested**  
✅ **All contracts verified on Sourcify**  
⚠️ **Core DAO explorer verification pending** (due to API issues)  

The contracts are ready for use even without explorer verification, as Sourcify provides the same verification guarantees.
