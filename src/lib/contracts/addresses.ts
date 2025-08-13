import { Address } from 'viem';

export interface ContractAddresses {
  CHAINCRAFT_FACTORY: Address;
  CHAINCRAFT_GOVERNANCE: Address;
  CHAINCRAFT_DEX_MANAGER: Address;
  WETH: Address;
}

// Contract addresses by chain ID - Core DAO Only
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Core DAO Mainnet (Chain ID: 1116)
  1116: {
    CHAINCRAFT_FACTORY: '0x6C38Fdd5263175738eA4bA775f7dC1a446fFe00F', // ChainCraftFactoryLite - Core DAO mainnet
    CHAINCRAFT_GOVERNANCE: '0x9995d8A4a5E58fA9e179c00a73384dd0f78AcaDB', // ChainCraftGovernance - Core DAO mainnet
    CHAINCRAFT_DEX_MANAGER: '0x795132570275CF47c2f0641e7ed36e81Fc6bF244', // ChainCraftDEXManager - Core DAO mainnet
    WETH: '0x40375c92d9faf44d2f9db9bd9ba41a3317a2404f', // WCORE on Core DAO (SushiSwap compatible)
  },
  // Core DAO Testnet2 (Chain ID: 1114) - Only enabled when testnets are enabled
  1114: {
    CHAINCRAFT_FACTORY: '0x9a06a11c2939278Df6f90c530aA728CAE94781ae', // Deployed on Core Testnet2
    CHAINCRAFT_GOVERNANCE: '0xbbAF9457Cf1ba26B204B980a955B5abf0A94CAe4', // Deployed on Core Testnet2
    CHAINCRAFT_DEX_MANAGER: '0x0000000000000000000000000000000000000000', // To be deployed when DEX infrastructure is available
    WETH: '0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f', // WCORE on Core DAO Testnet2
  },
  // Hardhat Local Network (for development only)
  31337: {
    CHAINCRAFT_FACTORY: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Default hardhat deployment address
    CHAINCRAFT_GOVERNANCE: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    CHAINCRAFT_DEX_MANAGER: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    WETH: '0xc778417e063141139fce010982780140aa0cd5ab', // Local WETH for testing
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
