import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// SushiSwap addresses for different networks
// Ethereum mainnet SwapRouter: SOMESUSHISWAPROUTER
// Ethereum mainnet NonfungiblePositionManager: SOMEFNPMANAGER
// Ethereum mainnet Factory: SUSHI_FACTORY_MAINNET
// Sepolia SwapRouter: SUSHI_SWAP_ROUTER_SEPOLIA
// Sepolia NonfungiblePositionManager: SUSHI_NPM_SEPOLIA
// Sepolia Factory: SUSHI_FACTORY_SEPOLIA

const SUSHI_SWAP_ROUTER = "0x3ced11c610556e5292fbc2e75d68c3899098c14c";
const WCORE = "0x191e94fa59739e188dce837f7f6978d84727ad01";

const DEXManagerModule = buildModule("ChainCraftDEXManager", (m) => {
  
  const dexManager = m.contract("ChainCraftDEXManager", [
    SUSHI_SWAP_ROUTER, // RouteProcessor7 address
    WCORE, // Wrapped CORE token
  ]);

  return { dexManager };
});

export default DEXManagerModule;
