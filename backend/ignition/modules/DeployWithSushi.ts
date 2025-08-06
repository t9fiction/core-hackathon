import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DeployWithSushiModule = buildModule("DeployWithSushi", (m) => {
  // SushiSwap V3 contract addresses on Sepolia
  const SUSHI_SWAP_ROUTER_SEPOLIA = "0x3cd1C46068dAEa5Ebb0d3f55F6915B10648062B8";
  const SUSHI_POSITION_MANAGER_SEPOLIA = "0x2B1c7b41f6A8F2b2bc45C3233a5d5FB3cD6dC9A8";
  const SUSHI_V3_FACTORY_SEPOLIA = "0xc35DADB65012eC5796536bD9864eD8773aBc74C4";
  const SUSHI_QUOTER_V2_SEPOLIA = "0xb1E835Dc2785b52265711e17fCCb0fd018226a6e";
  const WETH_SEPOLIA = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";

  // Deploy PumpFunDEXManager with SushiSwap contracts
  const pumpFunDEXManager = m.contract("PumpFunDEXManager", [
    SUSHI_SWAP_ROUTER_SEPOLIA,
    SUSHI_POSITION_MANAGER_SEPOLIA,
    SUSHI_V3_FACTORY_SEPOLIA,
    SUSHI_QUOTER_V2_SEPOLIA,
    WETH_SEPOLIA,
  ]);

  // Deploy PumpFunFactoryLite
  const pumpFunFactoryLite = m.contract("PumpFunFactoryLite", [
    pumpFunDEXManager,
  ]);

  return {
    pumpFunDEXManager,
    pumpFunFactoryLite,
  };
});

export default DeployWithSushiModule;
