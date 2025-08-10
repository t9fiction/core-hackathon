import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// SushiSwap addresses for different networks
// Ethereum mainnet SwapRouter: SOMESUSHISWAPROUTER
// Ethereum mainnet NonfungiblePositionManager: SOMEFNPMANAGER
// Ethereum mainnet Factory: SUSHI_FACTORY_MAINNET
// Sepolia SwapRouter: SUSHI_SWAP_ROUTER_SEPOLIA
// Sepolia NonfungiblePositionManager: SUSHI_NPM_SEPOLIA
// Sepolia Factory: SUSHI_FACTORY_SEPOLIA

const _swapRouter = process.env.SUSHI_SWAP_ROUTER || 'SUSHI_SWAP_ROUTER_SEPOLIA';
const _positionManager = process.env.SUSHI_POSITION_MANAGER || 'SUSHI_NPM_SEPOLIA';
const _uniswapV3Factory = process.env.SUSHI_FACTORY || 'SUSHI_FACTORY_SEPOLIA';
const _quoterV2 = process.env.UNISWAP_V3_QUOTER_V2 || '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3';
const _weth = process.env.WETH_ADDRESS || '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';

const DEXManagerModule = buildModule("ChainCraftDEXManager", (m) => {
  const swapRouterParam = m.getParameter("_swapRouter", _swapRouter);
  const positionManagerParam = m.getParameter("_positionManager", _positionManager);
  const uniswapV3FactoryParam = m.getParameter("_uniswapV3Factory", _uniswapV3Factory);
  const quoterV2Param = m.getParameter("_quoterV2", _quoterV2);
  const wethParam = m.getParameter("_weth", _weth);
  
  const dexManager = m.contract("ChainCraftDEXManager", [
    swapRouterParam,
    positionManagerParam,
    uniswapV3FactoryParam,
    quoterV2Param,
    wethParam
  ]);

  return { dexManager };
});

export default DEXManagerModule;
