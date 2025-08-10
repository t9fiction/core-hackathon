import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import GovernanceModule from "./ChainCraftGovernance";
import GovernanceAirdropModule from "./ChainCraftGovernanceAirdrop";

/**
 * ChainCraft Protocol Deployment with SushiSwap Integration
 * 
 * Deploys the complete protocol using SushiSwap V3 infrastructure:
 * - Core contracts (Factory & DEX Manager) 
 * - Governance system (Governance & Airdrop contracts)
 * - Configured for Sepolia testnet with SushiSwap addresses
 */
const DeployWithSushiModule = buildModule("DeployWithSushi", (m) => {
  // Use environment variables or fallback to generic addresses for testing
  const SUSHI_SWAP_ROUTER_SEPOLIA = process.env.SUSHI_SWAP_ROUTER || "0x93c31c9C729A249b2877F7699e178F4720407733";
  const SUSHI_POSITION_MANAGER_SEPOLIA = process.env.SUSHI_POSITION_MANAGER || "0x544bA588efD839d2692Fc31EA991cD39993c135F";
  const SUSHI_V3_FACTORY_SEPOLIA = process.env.SUSHI_FACTORY || "0x1f2FCf1d036b375b384012e61D3AA33F8C256bbE";
  const SUSHI_QUOTER_V2_SEPOLIA = process.env.UNISWAP_V2_QUOTER || "0x039e87AB90205F9d87c5b40d4B28e2Be45dA4a20";
  const WETH_SEPOLIA = process.env.WETH_ADDRESS || "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";

  // Deploy core infrastructure with SushiSwap integration
  const pumpFunDEXManager = m.contract("ChainCraftDEXManager", [
    SUSHI_SWAP_ROUTER_SEPOLIA,
    SUSHI_POSITION_MANAGER_SEPOLIA,
    SUSHI_V3_FACTORY_SEPOLIA,
    SUSHI_QUOTER_V2_SEPOLIA,
    WETH_SEPOLIA,
  ]);

  // Deploy ChainCraftFactoryLite
  const pumpFunFactoryLite = m.contract("ChainCraftFactoryLite");

  // Set up factory and DEX manager relationship
  m.call(pumpFunDEXManager, "setFactory", [pumpFunFactoryLite], { after: [pumpFunFactoryLite, pumpFunDEXManager] });
  m.call(pumpFunFactoryLite, "setDEXManager", [pumpFunDEXManager], { after: [pumpFunDEXManager, pumpFunFactoryLite] });

  // Deploy governance infrastructure
  const { governance } = m.useModule(GovernanceModule);
  const { airdrop } = m.useModule(GovernanceAirdropModule);

  return {
    // Core infrastructure
    pumpFunDEXManager,
    pumpFunFactoryLite,
    // Governance infrastructure
    governance,
    airdrop,
  };
});

export default DeployWithSushiModule;
