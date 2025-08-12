import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import GovernanceModule from "./ChainCraftGovernance";

// DEX Configuration - Environment variables with fallbacks
const SWAP_ROUTER = process.env.SUSHI_SWAP_ROUTER || "0x93c31c9C729A249b2877F7699e178F4720407733";
const POSITION_MANAGER = process.env.SUSHI_POSITION_MANAGER || "0x544bA588efD839d2692Fc31EA991cD39993c135F";
const SUSHI_FACTORY = process.env.SUSHI_FACTORY || "0x1f2FCf1d036b375b384012e61D3AA33F8C256bbE";
const _quoter = process.env.UNISWAP_V2_QUOTER || '0x039e87AB90205F9d87c5b40d4B28e2Be45dA4a20';
const WETH = process.env.WETH_ADDRESS || "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";




// const TOKEN_NAME = "DemoMeme";
// const TOKEN_SYMBOL = "DEMO";
// const TOTAL_SUPPLY = 10000000n;
// const LIQUIDITY_LOCK_PERIOD_DAYS = 30;

/**
 * Complete ChainCraft Protocol Deployment Module
 * 
 * Deploys all core contracts in the correct order:
 * 1. Factory and DEX Manager (token creation and liquidity management)
 * 2. Governance contracts (proposal and voting system)
 * 3. Sets up proper contract relationships
 */
const DeployAllContracts = buildModule("DeployAllContracts", (m: any) => {
  // Deploy core token infrastructure
  const factory = m.contract("ChainCraftFactoryLite");
  const dexManager = m.contract("ChainCraftDEXManager"); // Simplified - no parameters needed

  // Set up factory and DEX manager relationship
  m.call(dexManager, "setFactory", [factory], { after: [factory, dexManager] });
  m.call(factory, "setDEXManager", [dexManager], { after: [dexManager, factory] });

  // Deploy governance infrastructure
  const { governance } = m.useModule(GovernanceModule);

  // Example token deployment (commented out by default)
  // const requiredFee = m.staticCall(factory, "getRequiredFee", [TOTAL_SUPPLY]);
  // const deployToken = m.call(factory, "deployToken", [TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY], {
  //   value: requiredFee,
  //   from: m.getAccount(0),
  //   after: [factory]
  // });

  return { 
    // Core infrastructure
    factory, 
    dexManager,
    // Governance infrastructure 
    governance
  };
});

export default DeployAllContracts;