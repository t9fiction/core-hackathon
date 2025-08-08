const hre = require("hardhat");

/**
 * Deployment Script for PumpFun Governance Contracts
 * 
 * This script demonstrates how to deploy the governance contracts
 * and provides examples for different deployment scenarios.
 */

async function main() {
  console.log("🚀 Starting PumpFun Governance Deployment...\n");

  // Get network information
  const network = hre.network.name;
  const chainId = hre.network.config.chainId;
  console.log(`📡 Network: ${network} (Chain ID: ${chainId})`);

  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  try {
    // Deploy Governance Contract
    console.log("📝 Deploying PumpFunGovernance...");
    const PumpFunGovernance = await hre.ethers.getContractFactory("PumpFunGovernance");
    const governance = await PumpFunGovernance.deploy();
    await governance.waitForDeployment();
    
    const governanceAddress = await governance.getAddress();
    console.log(`✅ PumpFunGovernance deployed to: ${governanceAddress}\n`);

    // Deploy Governance Airdrop Contract
    console.log("📝 Deploying PumpFunGovernanceAirdrop...");
    const PumpFunGovernanceAirdrop = await hre.ethers.getContractFactory("PumpFunGovernanceAirdrop");
    const airdrop = await PumpFunGovernanceAirdrop.deploy(governanceAddress);
    await airdrop.waitForDeployment();
    
    const airdropAddress = await airdrop.getAddress();
    console.log(`✅ PumpFunGovernanceAirdrop deployed to: ${airdropAddress}\n`);

    // Verify deployment by checking contract properties
    console.log("🔍 Verifying deployment...");
    
    // Check governance contract
    const proposalCount = await governance.proposalCount();
    const votingPeriod = await governance.VOTING_PERIOD();
    const minVotingPower = await governance.MIN_VOTING_POWER();
    
    console.log(`   Governance - Proposal Count: ${proposalCount}`);
    console.log(`   Governance - Voting Period: ${votingPeriod} seconds (${Number(votingPeriod) / 86400} days)`);
    console.log(`   Governance - Min Voting Power: ${hre.ethers.formatEther(minVotingPower)} tokens`);

    // Check airdrop contract
    const governanceContract = await airdrop.governanceContract();
    const stats = await airdrop.getContractStats();
    
    console.log(`   Airdrop - Linked Governance: ${governanceContract}`);
    console.log(`   Airdrop - Total Airdrops Configured: ${stats._totalAirdropsConfigured}`);
    console.log(`   Airdrop - Total Tokens Distributed: ${stats._totalTokensDistributed}\n`);

    // Display deployment summary
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("========================");
    console.log(`Network: ${network} (${chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`PumpFunGovernance: ${governanceAddress}`);
    console.log(`PumpFunGovernanceAirdrop: ${airdropAddress}`);
    console.log("");

    // Display frontend configuration
    console.log("🔧 FRONTEND CONFIGURATION");
    console.log("===========================");
    console.log("Add these addresses to your contract addresses configuration:");
    console.log("");
    console.log(`// In src/lib/contracts/addresses.ts`);
    console.log(`${chainId}: {`);
    console.log(`  // ... other addresses ...`);
    console.log(`  PUMPFUN_GOVERNANCE: '${governanceAddress}',`);
    console.log(`  PUMPFUN_AIRDROP: '${airdropAddress}',`);
    console.log(`},`);
    console.log("");

    // Display next steps
    console.log("🎯 NEXT STEPS");
    console.log("===============");
    console.log("1. Update your frontend contract addresses");
    console.log("2. Deploy or connect to your factory contract");
    console.log("3. Deploy some tokens for governance testing");
    console.log("4. Create test proposals and verify the system works");
    console.log("5. Configure airdrops using merkle trees if needed");
    console.log("");

    console.log("🎉 Deployment completed successfully!");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Handle script execution
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
