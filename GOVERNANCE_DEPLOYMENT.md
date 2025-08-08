# 🏛️ Governance Contracts Deployment Guide

This document provides comprehensive instructions for deploying and configuring the PumpFun Governance system.

## 📋 Overview

The PumpFun Governance system consists of two main contracts:

1. **PumpFunGovernance** - Main governance contract handling proposals, voting, and execution
2. **PumpFunGovernanceAirdrop** - Merkle-based token airdrop system

## 🔧 Deployment Options

### Option 1: Using Hardhat Ignition (Recommended)

#### Deploy Individual Contracts

```bash
# Deploy just the governance contract
npx hardhat ignition deploy ignition/modules/PumpFunGovernance.ts --network <network>

# Deploy governance with airdrop system
npx hardhat ignition deploy ignition/modules/PumpFunGovernanceAirdrop.ts --network <network>
```

#### Deploy Complete System

```bash
# Deploy all contracts (factory, dex, governance)
npx hardhat ignition deploy ignition/modules/DeployAllContracts.ts --network <network>

# Deploy with SushiSwap integration
npx hardhat ignition deploy ignition/modules/DeployWithSushi.ts --network <network>
```

### Option 2: Using Deployment Script

```bash
# Deploy with detailed logging and verification
npx hardhat run scripts/deploy-governance.js --network <network>
```

## 🌐 Network Configuration

### Environment Variables

Create a `.env` file with your network configurations:

```bash
# RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_API_KEY

# Private Keys (use test keys only!)
PRIVATE_KEY=your_private_key_here

# DEX Integration Addresses
SUSHI_SWAP_ROUTER=0x...
SUSHI_POSITION_MANAGER=0x...
SUSHI_FACTORY=0x...
UNISWAP_V2_QUOTER=0x...
WETH_ADDRESS=0x...
```

### Network Examples

#### Sepolia Testnet
```bash
npx hardhat ignition deploy ignition/modules/DeployAllContracts.ts --network sepolia
```

#### Ethereum Mainnet
```bash
npx hardhat ignition deploy ignition/modules/DeployAllContracts.ts --network mainnet
```

#### Core DAO Testnet
```bash
npx hardhat ignition deploy ignition/modules/DeployAllContracts.ts --network core_testnet
```

## 📱 Frontend Integration

### Update Contract Addresses

After deployment, update your frontend configuration in `src/lib/contracts/addresses.ts`:

```typescript
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Your network chain ID
  11155111: { // Sepolia
    PUMPFUN_FACTORY: '0x...', // Your factory address
    PUMPFUN_GOVERNANCE: '0x...', // Deployed governance address
    PUMPFUN_DEX_MANAGER: '0x...', // Your DEX manager address  
    PUMPFUN_AIRDROP: '0x...', // Deployed airdrop address
    WETH: '0x...', // WETH address for your network
  },
  // Add other networks...
};
```

### Verify Frontend Compatibility

The deployed contracts are fully compatible with your existing frontend:

- ✅ All governance hooks (`useGovernance`, `useProposal`)
- ✅ All governance components (`CreateProposalForm`, `ProposalCard`)
- ✅ All proposal types (1-4) supported
- ✅ Fallback wallet system compatibility

## 🧪 Testing Deployment

### 1. Verify Contract Functions

```bash
# Run governance-specific tests
npx hardhat test test/PumpFunGovernance.test.js

# Run all tests to ensure no breaking changes
npx hardhat test
```

### 2. Test Governance Flow

1. **Deploy a test token** through the factory
2. **Create a test proposal** using the governance contract
3. **Vote on the proposal** with token holders
4. **Execute the proposal** after the voting period

### 3. Test Frontend Integration

1. **Start your frontend** application
2. **Connect a wallet** with tokens
3. **Navigate to governance page** (`/governance`)
4. **Create and vote on proposals**

## 📊 Governance Parameters

### Default Configuration

- **Voting Period**: 7 days (604800 seconds)
- **Minimum Voting Power**: 1000 tokens (to create proposals)
- **Proposal Types**: 4 supported types
  1. Update Max Transfer
  2. Update Max Holding
  3. Toggle Transfer Limits
  4. Execute Airdrop

### Proposal Lifecycle

1. **Creation** - Users with ≥1000 tokens can create proposals
2. **Voting** - 7-day voting period with token-weighted votes
3. **Execution** - Passed proposals can be executed by anyone
4. **Status Tracking** - Active → Passed/Failed → Executed

## 🎯 Airdrop Configuration

### Setting Up Airdrops

1. **Generate Merkle Tree** from recipient list
2. **Configure Airdrop** with merkle root and token allocation
3. **Recipients Claim** using merkle proofs

### Example Airdrop Setup

```javascript
// 1. Deploy tokens to airdrop contract
await token.transfer(airdropContract.address, totalAirdropAmount);

// 2. Configure airdrop with merkle root
await airdropContract.configureAirdrop(
  tokenAddress,
  merkleRoot,
  totalAmount,
  duration // 30 days = 30 * 24 * 60 * 60
);

// 3. Users claim with merkle proofs
await airdropContract.claimAirdrop(tokenAddress, amount, merkleProof);
```

## 🔐 Security Considerations

### Access Control

- **Governance Contract**: Proposals require minimum token balance
- **Airdrop Contract**: Only owner can configure airdrops
- **Emergency Functions**: Owner-only emergency withdrawal

### Best Practices

1. **Use multi-sig wallets** for contract ownership
2. **Test thoroughly** on testnets before mainnet
3. **Verify contracts** on block explorers
4. **Monitor governance activity** for malicious proposals
5. **Keep emergency procedures** documented

## 🚨 Troubleshooting

### Common Issues

#### Deployment Fails
- Check network configuration in `hardhat.config.js`
- Verify sufficient ETH balance for deployment
- Ensure RPC URL is working

#### Frontend Not Connecting
- Update contract addresses in `addresses.ts`
- Check network matches between frontend and contracts
- Verify ABI compatibility

#### Governance Not Working
- Ensure users have minimum token balance (1000 tokens)
- Check voting period hasn't expired
- Verify proposal execution conditions

### Support

If you encounter issues:

1. Check the test suite for examples
2. Review deployment logs for errors
3. Verify contract addresses and network configuration
4. Test with smaller amounts first

## 📚 Additional Resources

- [Hardhat Ignition Documentation](https://hardhat.org/ignition)
- [OpenZeppelin Governance](https://docs.openzeppelin.com/contracts/governance)
- [Merkle Tree Generator](https://github.com/miguelmota/merkletreejs)

---

🎉 **Your PumpFun Governance system is now ready for deployment!**
