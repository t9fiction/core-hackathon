import { Address } from 'viem';

export interface ContractAddresses {
  CHAINCRAFT_FACTORY: Address;
  CHAINCRAFT_GOVERNANCE: Address;
  CHAINCRAFT_DEX_MANAGER: Address;
  WETH: Address;
}

// Contract addresses by chain ID
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Sepolia Testnet
  11155111: {
    CHAINCRAFT_FACTORY: '0x272E905b82eEA7647e4863b27Fe5ECd210F3E9dE', // Actual deployed address
    CHAINCRAFT_GOVERNANCE: '0x276E5CC2B833685069b1805274e4CB56F2De97b3', // Actual deployed address
    CHAINCRAFT_DEX_MANAGER: '0x39A0B895C06aE3D0B058588AF0d0C14ac12c6fa0', // Actual deployed address
    WETH: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', // Sepolia WETH
  },
  1: {
    CHAINCRAFT_FACTORY: '0x698f497cE0c50eBB34a684e3b0D5747eFF552BE4', // Replace with actual deployed address
    CHAINCRAFT_GOVERNANCE: '0x8cB5E8aFE9Dd693596636F46af51F68A4FecceD6', // Replace with actual deployed address
    CHAINCRAFT_DEX_MANAGER: '0x5205d625115104ffeB3A9e5282F06d36f4CF6Ab9', // Replace with actual deployed address
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum Mainnet WETH
  },
  // Base Sepolia Testnet
  84532: {
    CHAINCRAFT_FACTORY: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    CHAINCRAFT_GOVERNANCE: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    CHAINCRAFT_DEX_MANAGER: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    WETH: '0x0000000000000000000000000000000000000000', // Dummy address for WETH
  },
  // Base Mainnet
  8453: {
    CHAINCRAFT_FACTORY: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    CHAINCRAFT_GOVERNANCE: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    CHAINCRAFT_DEX_MANAGER: '0x0000000000000000000000000000000000000000', // Replace with actual deployed address
    WETH: '0x0000000000000000000000000000000000000000', // Dummy address for WETH
  },
  // Core DAO Mainnet
  1116: {
    CHAINCRAFT_FACTORY: '0x322ae249923d378a7a92Cc58C578DaC6270d6b4b', // ChainCraftFactoryLite - Core DAO mainnet
    CHAINCRAFT_GOVERNANCE: '0x293dd95dC7A8Ce74dFF03DE130b16d9748b90d29', // ChainCraftGovernance - Core DAO mainnet
    CHAINCRAFT_DEX_MANAGER: '0x795132570275CF47c2f0641e7ed36e81Fc6bF244', // ChainCraftDEXManager - Core DAO mainnet (updated with new WCORE)
    WETH: '0x191e94fa59739e188dce837f7f6978d84727ad01', // WCORE on Core DAO (SushiSwap compatible)
  },
  // Core DAO Testnet2 (matches hardhat config)
  1114: {
    CHAINCRAFT_FACTORY: '0x9a06a11c2939278Df6f90c530aA728CAE94781ae', // Deployed on Core Testnet2
    CHAINCRAFT_GOVERNANCE: '0xbbAF9457Cf1ba26B204B980a955B5abf0A94CAe4', // Deployed on Core Testnet2
    CHAINCRAFT_DEX_MANAGER: '0x0000000000000000000000000000000000000000', // To be deployed when DEX infrastructure is available
    WETH: '0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f', // WCORE on Core DAO Testnet2
  },
  // Hardhat Local Network
  31337: {
    CHAINCRAFT_FACTORY: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Default hardhat deployment address
    CHAINCRAFT_GOVERNANCE: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    CHAINCRAFT_DEX_MANAGER: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
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
