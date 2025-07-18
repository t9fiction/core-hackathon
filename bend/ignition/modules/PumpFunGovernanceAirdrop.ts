// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const _governanceContract = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

const GovernanceAirdropModule = buildModule("PumpFunGovernanceAirdrop", (m) => {
  
    const governanceAirdropParams = m.getParameter("_governanceContract", _governanceContract);

    const airdrop = m.contract("PumpFunGovernanceAirdrop",[governanceAirdropParams]);

  return { airdrop };
});

export default GovernanceAirdropModule;
