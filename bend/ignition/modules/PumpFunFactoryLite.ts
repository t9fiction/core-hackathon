// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const FactoryModule = buildModule("PumpFunFactoryLite", (m) => {

  const factory = m.contract("PumpFunFactoryLite");

  return { factory };
});

export default FactoryModule;
