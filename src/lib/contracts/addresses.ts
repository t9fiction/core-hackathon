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
    PUMPFUN_FACTORY: '0x17a9814BF9dDBd5ae3C245F668561068984Dd8a4', // Actual deployed address
    PUMPFUN_GOVERNANCE: '0x44652C54bD053fB339912a2Ce28030Fda19edFd9', // Actual deployed address
    PUMPFUN_DEX_MANAGER: '0x8BA9a1E63b82DEB901b1311aD293B4039142Ea60', // Actual deployed address
    PUMPFUN_AIRDROP: '0x102A628D8a53a997F5aE6d9182255BBC54e8ccb6', // Replace with actual deployed address
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
  // Core DAO Mainnet
  1116: {
    PUMPFUN_FACTORY: '0x17a9814BF9dDBd5ae3C245F668561068984Dd8a4', // Replace with actual deployed address on Core
    PUMPFUN_GOVERNANCE: '0x44652C54bD053fB339912a2Ce28030Fda19edFd9', // Replace with actual deployed address on Core
    PUMPFUN_DEX_MANAGER: '0x8BA9a1E63b82DEB901b1311aD293B4039142Ea60', // Replace with actual deployed address on Core
    PUMPFUN_AIRDROP: '0x102A628D8a53a997F5aE6d9182255BBC54e8ccb6', // Replace with actual deployed address on Core
    WETH: '0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f', // WCORE on Core DAO
  },
  // Core DAO Testnet
  1115: {
    PUMPFUN_FACTORY: '0x17a9814BF9dDBd5ae3C245F668561068984Dd8a4', // Replace with actual deployed address on Core Testnet
    PUMPFUN_GOVERNANCE: '0x44652C54bD053fB339912a2Ce28030Fda19edFd9', // Replace with actual deployed address on Core Testnet
    PUMPFUN_DEX_MANAGER: '0x8BA9a1E63b82DEB901b1311aD293B4039142Ea60', // Replace with actual deployed address on Core Testnet
    PUMPFUN_AIRDROP: '0x102A628D8a53a997F5aE6d9182255BBC54e8ccb6', // Replace with actual deployed address on Core Testnet
    WETH: '0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f', // WCORE on Core DAO Testnet
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
// Base fee is 0.05 ETH as defined in the smart contract: uint256 public etherFee = 0.05 ether;
export const SUPPLY_TIERS = {
  STANDARD: {
    maxSupply: BigInt("100000000"),
    feeMultiplier: BigInt("1"),
    baseFee: 0.05, // ETH (0.05 * 1 = 0.05 ETH)
    name: 'Standard'
  },
  PREMIUM: {
    maxSupply: BigInt("500000000"),
    feeMultiplier: BigInt("5"),
    baseFee: 0.25, // ETH (0.05 * 5 = 0.25 ETH)
    name: 'Premium'
  },
  ULTIMATE: {
    maxSupply: BigInt("1000000000"),
    feeMultiplier: BigInt("10"),
    baseFee: 0.5, // ETH (0.05 * 10 = 0.5 ETH)
    name: 'Ultimate'
  }
} as const;

export const MIN_LIQUIDITY_LOCK_PERIOD_DAYS = 30;
export const BASE_FEE_ETH = 0.05;
