import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SWAP_ROUTER = process.env.UNISWAP_V3_SWAP_ROUTER || "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const POSITION_MANAGER = process.env.UNISWAP_V3_POSITION_MANAGER || "0x1238536071E1c677A632429e3655c799b22cDA52";
const UNISWAP_V3_FACTORY = process.env.UNISWAP_V3_FACTORY || "0x0227628f3F023bb0B980b67D528571c95c6DaC1c";
const WETH = process.env.WETH_ADDRESS || "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";

const TOKEN_NAME = "DemoMeme";
const TOKEN_SYMBOL = "DEMO";
const TOTAL_SUPPLY = 10000000n;
const LIQUIDITY_LOCK_PERIOD_DAYS = 30;

const DeployAllContracts = buildModule("DeployAllContracts", (m) => {
  const governance = m.contract("PumpFunGovernance");
  const airdrop = m.contract("PumpFunGovernanceAirdrop", [governance]);
  const factory = m.contract("PumpFunFactoryLite");
  const dexManager = m.contract("PumpFunDEXManager", [SWAP_ROUTER, POSITION_MANAGER, UNISWAP_V3_FACTORY, WETH]);

  m.call(dexManager,"setFactory", [factory], { after: [factory, dexManager] });
  m.call(factory, "setGovernanceManager", [governance], { after: [governance, factory] });
  const setAirdropManager = m.call(factory, "setAirdropManager", [airdrop], { after: [airdrop, factory] });
  m.call(factory, "setDEXManager", [dexManager], { after: [dexManager, factory] });

  const requiredFee = m.staticCall(factory, "getRequiredFee", [TOTAL_SUPPLY]);
  const deployToken = m.call(factory, "deployToken", [TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY, LIQUIDITY_LOCK_PERIOD_DAYS], {
    value: requiredFee,
    from: m.getAccount(0),
    after: [setAirdropManager] // Ensure airdrop manager is set before deploying token
  });
  m.call(governance, "setAirdropContract", [airdrop], { after: [airdrop, governance] });

  return { factory, governance, airdrop, dexManager, token: deployToken };
});

export default DeployAllContracts;