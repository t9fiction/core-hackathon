// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const tokenName = "DemoMeme";
const tokenSymbol = "DEMO";
const ownersAddress = "0x8ef123b0bCC118e522Fd202d11d691b88F38F312";
const totalSupply: bigint = 10000000n;
const factory = "0x549b1A8518E77c8E756b137751Bb06Aed00860Bf";

const TokenModule = buildModule("PumpFunToken", (m) => {
    const tokenNameParam = m.getParameter("tokenName", tokenName);
    const tokenSymbolParam = m.getParameter("tokenSymbol", tokenSymbol);
    const ownersAddressParam = m.getParameter("ownersAddress", ownersAddress);
    const totalSupplyParam = m.getParameter("totalSupply", totalSupply);
    const factoryParam = m.getParameter("factory", factory);

  const token = m.contract("PumpFunToken", [tokenNameParam, tokenSymbolParam, totalSupplyParam, ownersAddressParam, factoryParam]);

  return { token };
});

export default TokenModule;
