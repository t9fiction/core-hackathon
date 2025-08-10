// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const tokenName = "DemoMeme";
const tokenSymbol = "DEMO";
const ownersAddress = "0x8ef123b0bCC118e522Fd202d11d691b88F38F312";
const totalSupply: bigint = BigInt(10000000);

const TokenModule = buildModule("ChainCraftToken", (m) => {
    const tokenNameParam = m.getParameter("tokenName", tokenName);
    const tokenSymbolParam = m.getParameter("tokenSymbol", tokenSymbol);
    const ownersAddressParam = m.getParameter("ownersAddress", ownersAddress);
    const totalSupplyParam = m.getParameter("totalSupply", totalSupply);

  const token = m.contract("ChainCraftToken", [tokenNameParam, tokenSymbolParam, totalSupplyParam, ownersAddressParam]);

  return { token };
});

export default TokenModule;
