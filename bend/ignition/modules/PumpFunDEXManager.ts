import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// UniswapV3 addresses for different networks
// Ethereum mainnet SwapRouter: 0xE592427A0AEce92De3Edee1F18E0157C05861564
// Ethereum mainnet NonfungiblePositionManager: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
// Ethereum mainnet Factory: 0x1F98431c8aD98523631AE4a59f267346ea31F984
// Sepolia SwapRouter: 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
// Sepolia NonfungiblePositionManager: 0x1238536071E1c677A632429e3655c799b22cDA52
// Sepolia Factory: 0x0227628f3F023bb0B980b67D528571c95c6DaC1c

const _swapRouter = process.env.UNISWAP_V3_SWAP_ROUTER || '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const _positionManager = process.env.UNISWAP_V3_POSITION_MANAGER || '0x1238536071E1c677A632429e3655c799b22cDA52';
const _uniswapV3Factory = process.env.UNISWAP_V3_FACTORY || '0x0227628f3F023bb0B980b67D528571c95c6DaC1c';
const _weth = process.env.WETH_ADDRESS || '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';

const DEXManagerModule = buildModule("PumpFunDEXManager", (m) => {
  const swapRouterParam = m.getParameter("_swapRouter", _swapRouter);
  const positionManagerParam = m.getParameter("_positionManager", _positionManager);
  const uniswapV3FactoryParam = m.getParameter("_uniswapV3Factory", _uniswapV3Factory);
  const wethParam = m.getParameter("_weth", _weth);
  
  const dexManager = m.contract("PumpFunDEXManager", [
    swapRouterParam,
    positionManagerParam,
    uniswapV3FactoryParam,
    wethParam
  ]);

  return { dexManager };
});

export default DEXManagerModule;
