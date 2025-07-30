import { Address } from 'viem';

export interface ContractAddresses {
  PUMPFUN_FACTORY: Address;
  PUMPFUN_GOVERNANCE: Address;
  PUMPFUN_DEX_MANAGER: Address;
  PUMPFUN_AIRDROP: Address;
  WETH: Address;
}

// Contract addresses by chain ID
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Sepolia Testnet
  11155111: {
    PUMPFUN_FACTORY: '0xBc333399dDb0D27ea19C7fB2EaA78f2F0975B06a', // Actual deployed address
    PUMPFUN_GOVERNANCE: '0xF6bDD5fD3C1b29D234D58E1c33432758A529A058', // Actual deployed address
    PUMPFUN_DEX_MANAGER: '0x5C9EE35D9D14702f9cD5b301032FfB11CA786082', // Actual deployed address
    PUMPFUN_AIRDROP: '0xd84FDd7A89a11d89e3C83F4D0733aAC0083E9516', // Replace with actual deployed address
    WETH: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', // Sepolia WETH
  },
  1: {
    PUMPFUN_FACTORY: '0x698f497cE0c50eBB34a684e3b0D5747eFF552BE4', // Replace with actual deployed address
    PUMPFUN_GOVERNANCE: '0x8cB5E8aFE9Dd693596636F46af51F68A4FecceD6', // Replace with actual deployed address
    PUMPFUN_DEX_MANAGER: '0x5205d625115104ffeB3A9e5282F06d36f4CF6Ab9', // Replace with actual deployed address
    PUMPFUN_AIRDROP: '0x9A048eD6EA377a30aED7bb598c14310Fdd71f899', // Replace with actual deployed address
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum Mainnet WETH
  },
  // Base Sepolia Testnet
  84532: {
    PUMPFUN_FACTORY: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_GOVERNANCE: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_DEX_MANAGER: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_AIRDROP: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    WETH: '0x0000000000000000000000000000000000000000', // Dummy address for WETH
  },
  // Base Mainnet
  8453: {
    PUMPFUN_FACTORY: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_GOVERNANCE: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_DEX_MANAGER: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    PUMPFUN_AIRDROP: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    WETH: '0x0000000000000000000000000000000000000000', // Dummy address for WETH
  },
  // Hardhat Local Network
  31337: {
    PUMPFUN_FACTORY: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Default hardhat deployment address
    PUMPFUN_GOVERNANCE: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    PUMPFUN_DEX_MANAGER: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    PUMPFUN_AIRDROP: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    WETH: '0xc778417e063141139fce010982780140aa0cd5ab', // WETH for Hardhat (Rinkeby)
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
    maxSupply: BigInt("100000000"),
    feeMultiplier: BigInt("1"),
    baseFee: 0.05, // ETH
    name: 'Standard'
  },
  PREMIUM: {
    maxSupply: BigInt("500000000"),
    feeMultiplier: BigInt("3"),
    baseFee: 0.15, // ETH
    name: 'Premium'
  },
  ULTIMATE: {
    maxSupply: BigInt("1000000000"),
    feeMultiplier: BigInt("10"),
    baseFee: 0.50, // ETH
    name: 'Ultimate'
  }
} as const;

export const MIN_LIQUIDITY_LOCK_PERIOD_DAYS = 30;
export const BASE_FEE_ETH = 0.05;
