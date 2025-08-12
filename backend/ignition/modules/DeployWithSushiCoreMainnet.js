const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const GovernanceModule = require("./ChainCraftGovernance");
const GovernanceAirdropModule = require("./ChainCraftGovernanceAirdrop");

/**
 * ChainCraft Protocol Deployment with SushiSwap Integration
 * 
 * Deploys the complete protocol using SushiSwap RouteProcessor7 infrastructure:
 * - Core contracts (Factory & DEX Manager) 
 * - Governance system (Governance & Airdrop contracts)
 * - Configured for Core DAO mainnet with SushiSwap addresses
 */
const DeployWithSushiModule = buildModule("DeployWithSushi", (m) => {
  // SushiSwap RouteProcessor7 addresses for Core DAO mainnet
  const SUSHI_SWAP_ROUTER = "0x3ced11c610556e5292fbc2e75d68c3899098c14c"; // RouteProcessor7 on Core DAO
  const SUSHI_POSITION_MANAGER = "0xf4d73326c13a4fc5fd7a064217e12780e9bd62c3"; // Keep for V3 liquidity
  const SUSHI_V3_FACTORY = "0xc35DADB65012eC5796536bD9864eD8773aBc74C4"; // Keep for pool creation
  const SUSHI_QUOTER_V2 = "0x0000000000000000000000000000000000000000"; // Not needed for RouteProcessor7
  const WCORE = "0x191e94fa59739e188dce837f7f6978d84727ad01"; // Wrapped CORE token

  // Deploy core infrastructure with SushiSwap RouteProcessor7 integration
  const pumpFunDEXManager = m.contract("ChainCraftDEXManager", [
    SUSHI_SWAP_ROUTER, // RouteProcessor7 address
    WCORE, // Wrapped CORE token
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

module.exports = DeployWithSushiModule;
