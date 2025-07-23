import { Address } from 'viem';

export interface ContractAddresses {
  PUMPFUN_FACTORY: Address;
  PUMPFUN_GOVERNANCE: Address;
  PUMPFUN_DEX_MANAGER: Address;
  PUMPFUN_AIRDROP: Address;
}

// Contract addresses by chain ID
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Sepolia Testnet
  11155111: {
    PUMPFUN_FACTORY: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_GOVERNANCE: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_DEX_MANAGER: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_AIRDROP: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
  },
  // Base Sepolia Testnet
  84532: {
    PUMPFUN_FACTORY: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_GOVERNANCE: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_DEX_MANAGER: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_AIRDROP: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
  },
  // Base Mainnet
  8453: {
    PUMPFUN_FACTORY: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_GOVERNANCE: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_DEX_MANAGER: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_AIRDROP: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
  },
  // Hardhat Local Network
  31337: {
    PUMPFUN_FACTORY: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Default hardhat deployment address
    PUMPFUN_GOVERNANCE: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    PUMPFUN_DEX_MANAGER: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    PUMPFUN_AIRDROP: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  },
};

export function getContractAddresses(chainId: number): ContractAddresses {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`Contract addresses not configured for chain ID: ${chainId}`);
  }
  return addresses;
}

// Supply tier constants (from contracts)
export const SUPPLY_TIERS = {
  STANDARD: {
    maxSupply: 100000000n,
    feeMultiplier: 1n,
    baseFee: 0.05, // ETH
    name: 'Standard'
  },
  PREMIUM: {
    maxSupply: 500000000n,
    feeMultiplier: 3n,
    baseFee: 0.15, // ETH
    name: 'Premium'
  },
  ULTIMATE: {
    maxSupply: 1000000000n,
    feeMultiplier: 10n,
    baseFee: 0.50, // ETH
    name: 'Ultimate'
  }
} as const;

export const MIN_LIQUIDITY_LOCK_PERIOD_DAYS = 30;
export const BASE_FEE_ETH = 0.05;
