const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ChainCraft Protocol to Core Testnet2...");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  // Check deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "CORE");
  
  if (balance === 0n) {
    console.log("❌ No CORE tokens found! Get testnet CORE from: https://scan.test.btcs.network/faucet");
    return;
  }

  // Core Testnet2 Configuration
  const WCORE_ADDRESS = "0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f"; // WCORE on Core testnet2
  
  console.log("\n📋 Configuration:");
  console.log("- WCORE Address:", WCORE_ADDRESS);
  console.log("- Network: Core Testnet2 (chainId: 1114)");
  
  // Note: For now using placeholder addresses for DEX infrastructure
  // These will need to be updated with actual Core testnet2 DEX addresses when available
  const DEX_CONFIG = {
    swapRouter: "0x0000000000000000000000000000000000000000",
    positionManager: "0x0000000000000000000000000000000000000000",
    factory: "0x0000000000000000000000000000000000000000",
    quoter: "0x0000000000000000000000000000000000000000"
  };

  try {
    console.log("\n🏗️  Starting deployment...");
    
    // 1. Deploy Factory
    console.log("1️⃣  Deploying ChainCraftFactoryLite...");
    const FactoryContract = await ethers.getContractFactory("ChainCraftFactoryLite");
    const factory = await FactoryContract.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("✅ Factory deployed to:", factoryAddress);
    
    // 2. Deploy DEX Manager
    console.log("\n2️⃣  Deploying ChainCraftDEXManager...");
    const DEXManagerContract = await ethers.getContractFactory("ChainCraftDEXManager");
    const dexManager = await DEXManagerContract.deploy(
      DEX_CONFIG.swapRouter,
      DEX_CONFIG.positionManager,
      DEX_CONFIG.factory,
      DEX_CONFIG.quoter,
      WCORE_ADDRESS
    );
    await dexManager.waitForDeployment();
    const dexManagerAddress = await dexManager.getAddress();
    console.log("✅ DEX Manager deployed to:", dexManagerAddress);
    
    // 3. Set up relationships
    console.log("\n3️⃣  Setting up contract relationships...");
    await dexManager.setFactory(factoryAddress);
    console.log("✅ DEX Manager -> Factory relationship set");
    
    await factory.setDEXManager(dexManagerAddress);
    console.log("✅ Factory -> DEX Manager relationship set");
    
    // 4. Deploy Governance
    console.log("\n4️⃣  Deploying Governance contracts...");
    const GovernanceContract = await ethers.getContractFactory("ChainCraftGovernance");
    const governance = await GovernanceContract.deploy();
    await governance.waitForDeployment();
    const governanceAddress = await governance.getAddress();
    console.log("✅ Governance deployed to:", governanceAddress);
    
    // 5. Deploy Airdrop
    console.log("\n5️⃣  Deploying Airdrop contract...");
    const AirdropContract = await ethers.getContractFactory("ChainCraftGovernanceAirdrop");
    const airdrop = await AirdropContract.deploy();
    await airdrop.waitForDeployment();
    const airdropAddress = await airdrop.getAddress();
    console.log("✅ Airdrop deployed to:", airdropAddress);
    
    // Summary
    console.log("\n🎉 Deployment Complete!");
    console.log("=".repeat(60));
    console.log("📋 Contract Addresses (Core Testnet2 - ChainID: 1114):");
    console.log("=".repeat(60));
    console.log("Factory:      ", factoryAddress);
    console.log("DEX Manager:  ", dexManagerAddress);
    console.log("Governance:   ", governanceAddress);
    console.log("Airdrop:      ", airdropAddress);
    console.log("WCORE:        ", WCORE_ADDRESS);
    console.log("=".repeat(60));
    
    console.log("\n📝 Next steps:");
    console.log("1. Update src/lib/contracts/addresses.ts with these addresses");
    console.log("2. Configure Core testnet2 DEX infrastructure addresses if needed");
    console.log("3. Test your contracts on Core testnet2");
    
    // Create addresses update snippet
    console.log("\n📋 Copy this to your addresses.ts file (chainId 1114):");
    console.log(`
    1114: {
      CHAINCRAFT_FACTORY: '${factoryAddress}',
      CHAINCRAFT_GOVERNANCE: '${governanceAddress}',
      CHAINCRAFT_DEX_MANAGER: '${dexManagerAddress}',
      CHAINCRAFT_AIRDROP: '${airdropAddress}',
      WETH: '${WCORE_ADDRESS}',
    },`);
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
