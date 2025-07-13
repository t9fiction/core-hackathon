# PumpFun Scripts Directory

This directory contains the essential scripts for deploying and managing PumpFun tokens with Uniswap V3 integration.

## Core Scripts

### 1. `deploy-pumpfun.js`
**Purpose:** Deploy all PumpFun contracts to the network
**Usage:** 
```bash
npx hardhat run scripts/deploy-pumpfun.js --network localhost
```
**What it does:**
- Deploys PumpFunToken, PumpFunFactoryLite, and PumpFunDEXManager contracts
- Configures the contracts for proper integration
- Saves deployment addresses to `pumpfun-deployments.json`
- Verifies all deployments

### 2. `deploy-token.js`
**Purpose:** Deploy a single token using the Factory contract
**Usage:**
```bash
npx hardhat run scripts/deploy-token.js --network localhost
```
**What it does:**
- Uses the deployed Factory contract to create a new token
- Demonstrates token creation workflow
- Verifies token deployment

### 3. `complete-flow.js`
**Purpose:** Complete end-to-end demonstration of token deployment + DEX pool creation
**Usage:**
```bash
npx hardhat run scripts/complete-flow.js --network localhost
```
**What it does:**
- Deploys a new token using the Factory
- Creates a Uniswap V3 pool for the token
- Adds liquidity to the pool
- Verifies the complete setup

## Utility Scripts

### 4. `diagnose-deployment.js`
**Purpose:** Diagnose deployment issues and verify contract states
**Usage:**
```bash
npx hardhat run scripts/diagnose-deployment.js --network localhost
```
**What it does:**
- Checks if deployment files exist
- Verifies network connectivity
- Tests contract addresses and functionality
- Provides detailed diagnostics

### 5. `fix-deployment-issues.js`
**Purpose:** Automatically fix common deployment issues
**Usage:**
```bash
npx hardhat run scripts/fix-deployment-issues.js --network localhost
```
**What it does:**
- Detects common problems (missing deployments, network issues)
- Automatically redeploys contracts if needed
- Fixes configuration issues

## Support Files

### 6. `abi.js`
**Purpose:** Contains ABI definitions for Uniswap V3 contracts
**Usage:** Imported by other scripts
**Contains:**
- Uniswap V3 Factory ABI
- Uniswap V3 Pool ABI

## Workflow

### First Time Setup
1. Start hardhat node: `npx hardhat node --fork <RPC_URL>`
2. Deploy contracts: `npx hardhat run scripts/deploy-pumpfun.js --network localhost`
3. Run complete flow: `npx hardhat run scripts/complete-flow.js --network localhost`

### Troubleshooting
1. If deployment fails: `npx hardhat run scripts/diagnose-deployment.js --network localhost`
2. Auto-fix issues: `npx hardhat run scripts/fix-deployment-issues.js --network localhost`

### Token Creation Only
1. Deploy single token: `npx hardhat run scripts/deploy-token.js --network localhost`

## Network Configuration

The scripts are designed to work with:
- **Localhost:** Hardhat forked mainnet
- **Mainnet:** Ethereum mainnet (update addresses in deployment modules)
- **Sepolia:** Ethereum testnet (update addresses in deployment modules)

## Important Files Created

- `pumpfun-deployments.json`: Contains all deployed contract addresses
- Console output provides transaction hashes and addresses for verification

## Requirements

- Hardhat node running on localhost:8545
- Sufficient ETH balance for deployments
- Proper network configuration in hardhat.config.js

## Notes

- All scripts include comprehensive error handling
- Deployment addresses are automatically saved and reused
- Scripts verify contract functionality before completion
- Use `--network localhost` for local development
- Use `--network mainnet` or `--network sepolia` for live deployments
