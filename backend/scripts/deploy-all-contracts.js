const hre = require("hardhat");

async function main() {
  console.log("Deploying All ChainCraft Contracts to Core DAO Mainnet...");
  console.log("=" .repeat(60));
  
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", await deployer.getAddress());
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "CORE");
  
  // Gas settings that work with Core DAO mainnet
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
  console.log("");

  // 1. Deploy ChainCraftGovernance
  console.log("🏛️  Deploying ChainCraftGovernance...");
  const ChainCraftGovernance = await hre.ethers.getContractFactory("ChainCraftGovernance");
  const governance = await ChainCraftGovernance.deploy(gasSettings);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("✅ ChainCraftGovernance deployed to:", governanceAddress);
  console.log("");

  // 2. Deploy ChainCraftFactoryLite
  console.log("🏭 Deploying ChainCraftFactoryLite...");
  const ChainCraftFactoryLite = await hre.ethers.getContractFactory("ChainCraftFactoryLite");
  const factory = await ChainCraftFactoryLite.deploy(gasSettings);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ ChainCraftFactoryLite deployed to:", factoryAddress);
  console.log("");

  // 3. Deploy a sample ChainCraftToken to demonstrate functionality
  console.log("🪙 Deploying Sample ChainCraftToken...");
  const ChainCraftToken = await hre.ethers.getContractFactory("ChainCraftToken");
  const tokenName = "ChainCraft Sample Token";
  const tokenSymbol = "CCST";
  const totalSupply = 1000000; // 1 million tokens
  const creator = deployer.address;
  
  const token = await ChainCraftToken.deploy(
    tokenName,
    tokenSymbol, 
    totalSupply,
    creator,
    gasSettings
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ ChainCraftToken deployed to:", tokenAddress);
  console.log("   Name:", tokenName);
  console.log("   Symbol:", tokenSymbol);
  console.log("   Total Supply:", totalSupply.toLocaleString());
  console.log("   Creator:", creator);
  console.log("");

  // Verify token details
  console.log("🔍 Verifying Token Details...");
  const tokenDetails = {
    name: await token.name(),
    symbol: await token.symbol(),
    totalSupply: await token.totalSupply(),
    decimals: await token.decimals(),
    owner: await token.owner(),
    factoryAddress: await token.factoryAddress(),
    transferLimit: await token.getTransferLimit(),
    holdingLimit: await token.getHoldingLimit()
  };
  
  console.log("   Token Name:", tokenDetails.name);
  console.log("   Token Symbol:", tokenDetails.symbol);
  console.log("   Total Supply:", hre.ethers.formatEther(tokenDetails.totalSupply));
  console.log("   Decimals:", tokenDetails.decimals.toString());
  console.log("   Owner:", tokenDetails.owner);
  console.log("   Factory:", tokenDetails.factoryAddress);
  console.log("   Transfer Limit:", hre.ethers.formatEther(tokenDetails.transferLimit));
  console.log("   Holding Limit:", hre.ethers.formatEther(tokenDetails.holdingLimit));
  console.log("");

  // Final balance check
  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - finalBalance;
  console.log("💰 Gas Usage Summary:");
  console.log("   Initial Balance:", hre.ethers.formatEther(balance), "CORE");
  console.log("   Final Balance:", hre.ethers.formatEther(finalBalance), "CORE");
  console.log("   Total Gas Used:", hre.ethers.formatEther(gasUsed), "CORE");
  console.log("");

  console.log("=" .repeat(60));
  console.log("🎉 ALL CONTRACTS DEPLOYED SUCCESSFULLY!");
  console.log("=" .repeat(60));
  
  console.log("\n📋 DEPLOYMENT SUMMARY:");
  console.log("┌─────────────────────────┬────────────────────────────────────────────┐");
  console.log("│ Contract                │ Address                                    │");
  console.log("├─────────────────────────┼────────────────────────────────────────────┤");
  console.log(`│ ChainCraftGovernance    │ ${governanceAddress} │`);
  console.log(`│ ChainCraftFactoryLite   │ ${factoryAddress} │`);
  console.log(`│ ChainCraftToken (Sample)│ ${tokenAddress} │`);
  console.log("└─────────────────────────┴────────────────────────────────────────────┘");
  
  console.log("\n🔗 EXPLORER LINKS:");
  console.log(`   Governance: https://scan.coredao.org/address/${governanceAddress}`);
  console.log(`   Factory:    https://scan.coredao.org/address/${factoryAddress}`);
  console.log(`   Token:      https://scan.coredao.org/address/${tokenAddress}`);
  
  console.log("\n🔧 VERIFICATION COMMANDS:");
  console.log(`   npx hardhat verify --network core_mainnet ${governanceAddress}`);
  console.log(`   npx hardhat verify --network core_mainnet ${factoryAddress}`);
  console.log(`   npx hardhat verify --network core_mainnet ${tokenAddress} "${tokenName}" "${tokenSymbol}" ${totalSupply} "${creator}"`);
  
  console.log("\n" + "=" .repeat(60));
  console.log("Deployment completed! 🚀");
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:", error);
  process.exitCode = 1;
});
