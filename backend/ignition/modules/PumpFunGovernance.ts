// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * PumpFun Governance Contract Deployment Module
 * 
 * Deploys the main governance contract that handles:
 * - Proposal creation and voting
 * - Token-weighted voting system
 * - Proposal execution after voting period
 * - Support for various proposal types (transfer limits, airdrops, etc.)
 */
const GovernanceModule = buildModule("PumpFunGovernance", (m) => {
  // Deploy the main governance contract
  const governance = m.contract("PumpFunGovernance");

  return { governance };
});

export default GovernanceModule;
