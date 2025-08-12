const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment of ChainCraft Protocol - 3 Core Contracts");
  console.log("=" .repeat(70));

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📋 Deploying contracts with account:", deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "CORE");

  if (balance < ethers.parseEther("0.1")) {
    throw new Error("❌ Insufficient balance. Need at least 0.1 CORE for deployment.");
  }

  console.log("\n🏗️  Deploying contracts...\n");

  // Deploy ChainCraftGovernance
  console.log("1️⃣  Deploying ChainCraftGovernance...");
  const ChainCraftGovernance = await ethers.getContractFactory("ChainCraftGovernance");
  const governance = await ChainCraftGovernance.deploy({
    gasLimit: 3000000,
    gasPrice: ethers.parseUnits("35", "gwei")
  });
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("✅ ChainCraftGovernance deployed to:", governanceAddress);

  // Deploy ChainCraftFactoryLite
  console.log("2️⃣  Deploying ChainCraftFactoryLite...");
  const ChainCraftFactoryLite = await ethers.getContractFactory("ChainCraftFactoryLite");
  const factory = await ChainCraftFactoryLite.deploy({
    gasLimit: 5000000,
    gasPrice: ethers.parseUnits("35", "gwei")
  });
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ ChainCraftFactoryLite deployed to:", factoryAddress);

  // Deploy ChainCraftToken (as template for verification)
  console.log("3️⃣  Deploying ChainCraftToken (Template)...");
  const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
  const tokenTemplate = await ChainCraftToken.deploy(
    "ChainCraft Template Token",
    "CCT",
    1000000, // 1M tokens
    deployer.address,
    {
      gasLimit: 3000000,
      gasPrice: ethers.parseUnits("35", "gwei")
    }
  );
  await tokenTemplate.waitForDeployment();
  const tokenTemplateAddress = await tokenTemplate.getAddress();
  console.log("✅ ChainCraftToken (Template) deployed to:", tokenTemplateAddress);

  console.log("\n🎉 All contracts deployed successfully!");
  console.log("=" .repeat(70));
  console.log("📋 **DEPLOYMENT SUMMARY**");
  console.log("-" .repeat(70));
  console.log("✅ ChainCraftGovernance:   ", governanceAddress);
  console.log("✅ ChainCraftFactoryLite:  ", factoryAddress);
  console.log("✅ ChainCraftToken Template:", tokenTemplateAddress);

  console.log("\n🔗 **Block Explorer Links:**");
  console.log("-" .repeat(70));
  console.log("Governance: https://scan.coredao.org/address/" + governanceAddress + "#code");
  console.log("Factory:    https://scan.coredao.org/address/" + factoryAddress + "#code");
  console.log("Token:      https://scan.coredao.org/address/" + tokenTemplateAddress + "#code");

  // Save deployment info
  const deploymentData = {
    network: "core_mainnet",
    chainId: 1116,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ChainCraftGovernance: governanceAddress,
      ChainCraftFactoryLite: factoryAddress,
      ChainCraftTokenTemplate: tokenTemplateAddress
    }
  };

  console.log("\n💾 Deployment data saved for verification process");
  console.log("⏳ Waiting 30 seconds before starting verification...");
  
  // Wait for block confirmations
  await new Promise(resolve => setTimeout(resolve, 30000));

  return deploymentData;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = { main };
