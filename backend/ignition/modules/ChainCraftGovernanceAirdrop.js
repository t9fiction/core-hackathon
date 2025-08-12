// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const GovernanceModule = require("./ChainCraftGovernance");

/**
 * ChainCraft Governance Airdrop Contract Deployment Module
 * 
 * Deploys the governance airdrop contract that handles:
 * - Merkle proof-based token airdrops
 * - Batch claim functionality
 * - Emergency withdrawal mechanisms
 * - Airdrop configuration and management
 */
const GovernanceAirdropModule = buildModule("ChainCraftGovernanceAirdrop", (m) => {
  // Import governance contract from the governance module
  const { governance } = m.useModule(GovernanceModule);
  
  // Deploy airdrop contract with governance contract address
  const airdrop = m.contract("ChainCraftGovernanceAirdrop", [governance]);

  return { airdrop, governance };
});

module.exports = GovernanceAirdropModule;
