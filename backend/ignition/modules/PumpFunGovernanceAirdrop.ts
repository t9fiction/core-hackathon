// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import GovernanceModule from "./PumpFunGovernance";

/**
 * PumpFun Governance Airdrop Contract Deployment Module
 * 
 * Deploys the governance airdrop contract that handles:
 * - Merkle proof-based token airdrops
 * - Batch claim functionality
 * - Emergency withdrawal mechanisms
 * - Airdrop configuration and management
 */
const GovernanceAirdropModule = buildModule("PumpFunGovernanceAirdrop", (m) => {
  // Import governance contract from the governance module
  const { governance } = m.useModule(GovernanceModule);
  
  // Deploy airdrop contract with governance contract address
  const airdrop = m.contract("PumpFunGovernanceAirdrop", [governance]);

  return { airdrop, governance };
});

export default GovernanceAirdropModule;
