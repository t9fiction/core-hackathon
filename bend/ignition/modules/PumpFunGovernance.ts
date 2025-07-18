// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const GovernanceModule = buildModule("PumpFunGovernance", (m) => {

  const factory = m.contract("PumpFunGovernance");

  return { factory };
});

export default GovernanceModule;
