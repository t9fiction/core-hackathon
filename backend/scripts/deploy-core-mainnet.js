const hre = require("hardhat");

async function main() {
  console.log("Deploying ChainCraft Protocol to Core DAO Mainnet...");
  
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", await deployer.getAddress());
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "CORE");
  
  // Gas settings that should work with Core DAO
  const gasSettings = {
    gasLimit: 8000000,
    maxFeePerGas: hre.ethers.parseUnits("50", "gwei"),
    maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
  };
  
  console.log("Using gas settings:", {
    gasLimit: gasSettings.gasLimit,
    maxFeePerGas: hre.ethers.formatUnits(gasSettings.maxFeePerGas, "gwei") + " gwei",
    maxPriorityFeePerGas: hre.ethers.formatUnits(gasSettings.maxPriorityFeePerGas, "gwei") + " gwei",
  });
  
  // Deploy ChainCraftGovernance
  console.log("\nDeploying ChainCraftGovernance...");
  const ChainCraftGovernance = await hre.ethers.getContractFactory("ChainCraftGovernance");
  const governance = await ChainCraftGovernance.deploy(gasSettings);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("ChainCraftGovernance deployed to:", governanceAddress);
  
  // Deploy ChainCraftFactoryLite
  console.log("\nDeploying ChainCraftFactoryLite...");
  const ChainCraftFactoryLite = await hre.ethers.getContractFactory("ChainCraftFactoryLite");
  const factory = await ChainCraftFactoryLite.deploy(gasSettings);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("ChainCraftFactoryLite deployed to:", factoryAddress);
  
  console.log("\n=== Deployment Summary ===");
  console.log("ChainCraftGovernance:", governanceAddress);
  console.log("ChainCraftFactoryLite:", factoryAddress);
  
  console.log("\n=== Verification Commands ===");
  console.log(`npx hardhat verify --network core_mainnet ${governanceAddress}`);
  console.log(`npx hardhat verify --network core_mainnet ${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
