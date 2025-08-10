import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import GovernanceModule from "./ChainCraftGovernance";
import GovernanceAirdropModule from "./ChainCraftGovernanceAirdrop";

// Core Testnet2 Configuration
const CORE_TESTNET2_CONFIG = {
  // WCORE address on Core testnet2 (equivalent to WETH on Ethereum)
  WETH: "0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f",
  
  // SushiSwap Core testnet2 addresses (if available, otherwise will need to be updated)
  SWAP_ROUTER: process.env.CORE_SWAP_ROUTER || "0x0000000000000000000000000000000000000000",
  POSITION_MANAGER: process.env.CORE_POSITION_MANAGER || "0x0000000000000000000000000000000000000000", 
  FACTORY: process.env.CORE_FACTORY || "0x0000000000000000000000000000000000000000",
  QUOTER: process.env.CORE_QUOTER || "0x0000000000000000000000000000000000000000",
};

/**
 * Core Testnet2 Protocol Deployment Module
 * 
 * Deploys all contracts configured specifically for Core testnet2:
 * - Uses WCORE as the wrapped native token
 * - Configured for Core testnet2 DEX infrastructure
 */
const DeployOnCoreTestnet2 = buildModule("DeployOnCoreTestnet2", (m: any) => {
  console.log("Deploying ChainCraft Protocol on Core Testnet2...");
  console.log("WCORE Address:", CORE_TESTNET2_CONFIG.WETH);

  // Deploy core token infrastructure with Core testnet2 configuration
  const factory = m.contract("ChainCraftFactoryLite");
  
  const dexManager = m.contract("ChainCraftDEXManager", [
    CORE_TESTNET2_CONFIG.SWAP_ROUTER,
    CORE_TESTNET2_CONFIG.POSITION_MANAGER, 
    CORE_TESTNET2_CONFIG.FACTORY,
    CORE_TESTNET2_CONFIG.QUOTER,
    CORE_TESTNET2_CONFIG.WETH // WCORE address
  ]);

  // Set up factory and DEX manager relationship
  m.call(dexManager, "setFactory", [factory], { after: [factory, dexManager] });
  m.call(factory, "setDEXManager", [dexManager], { after: [dexManager, factory] });

  // Deploy governance infrastructure
  const { governance } = m.useModule(GovernanceModule);
  const { airdrop } = m.useModule(GovernanceAirdropModule);

  console.log("Core Testnet2 deployment configuration:");
  console.log("- Factory: ChainCraftFactoryLite");
  console.log("- DEX Manager: ChainCraftDEXManager");  
  console.log("- WCORE (Wrapped CORE):", CORE_TESTNET2_CONFIG.WETH);
  console.log("- Chain ID: 1114");
  console.log("- Network: Core Testnet2");

  return { 
    // Core infrastructure
    factory, 
    dexManager,
    // Governance infrastructure 
    governance,
    airdrop,
    // Configuration used
    config: CORE_TESTNET2_CONFIG
  };
});

export default DeployOnCoreTestnet2;
