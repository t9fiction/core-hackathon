import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SWAP_ROUTER = process.env.SUSHI_SWAP_ROUTER || "0x93c31c9C729A249b2877F7699e178F4720407733";
const POSITION_MANAGER = process.env.SUSHI_POSITION_MANAGER || "0x544bA588efD839d2692Fc31EA991cD39993c135F";
const SUSHI_FACTORY = process.env.SUSHI_FACTORY || "0x1f2FCf1d036b375b384012e61D3AA33F8C256bbE";
const _quoter = process.env.UNISWAP_V2_QUOTER || '0x039e87AB90205F9d87c5b40d4B28e2Be45dA4a20';
const WETH = process.env.WETH_ADDRESS || "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";




// const TOKEN_NAME = "DemoMeme";
// const TOKEN_SYMBOL = "DEMO";
// const TOTAL_SUPPLY = 10000000n;
// const LIQUIDITY_LOCK_PERIOD_DAYS = 30;

const DeployAllContracts = buildModule("DeployAllContracts", (m:any) => {
  const factory = m.contract("PumpFunFactoryLite");
  const dexManager = m.contract("PumpFunDEXManager", [SWAP_ROUTER, POSITION_MANAGER, SUSHI_FACTORY, _quoter, WETH]);

  m.call(dexManager,"setFactory", [factory], { after: [factory, dexManager] });
  m.call(factory, "setDEXManager", [dexManager], { after: [dexManager, factory] });

  // const requiredFee = m.staticCall(factory, "getRequiredFee", [TOTAL_SUPPLY]);
  // const deployToken = m.call(factory, "deployToken", [TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY, LIQUIDITY_LOCK_PERIOD_DAYS], {
  //   value: requiredFee,
  //   from: m.getAccount(0),
  //   after: [factory] // Ensure factory is deployed
  // });

  return { factory, dexManager };
});

export default DeployAllContracts;