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
  const SUSHI_SWAP_ROUTER = "0x3ced11c610556e5292fbc2e75d68c3899098c14c";
  const SUSHI_POSITION_MANAGER = "0xf4d73326c13a4fc5fd7a064217e12780e9bd62c3";
  const SUSHI_V3_FACTORY = "0xc35DADB65012eC5796536bD9864eD8773aBc74C4";
  const SUSHI_QUOTER_V2 = "";
  const WCORE = "0x40375c92d9faf44d2f9db9bd9ba41a3317a2404f";

  // Deploy core infrastructure with SushiSwap integration
  const pumpFunDEXManager = m.contract("ChainCraftDEXManager", [
    SUSHI_SWAP_ROUTER,
    SUSHI_POSITION_MANAGER,
    SUSHI_V3_FACTORY,
    SUSHI_QUOTER_V2,
    WCORE,
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
