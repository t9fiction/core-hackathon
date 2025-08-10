const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ChainCraft Protocol to Core Testnet2 (Simplified)...");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  // Check deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "CORE");
  
  if (balance === 0n) {
    console.log("❌ No CORE tokens found! Get testnet CORE from: https://scan.test2.btcs.network/faucet");
    return;
  }

  // Core Testnet2 Configuration
  const WCORE_ADDRESS = "0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f"; // WCORE on Core testnet2
  
  console.log("\n📋 Configuration:");
  console.log("- WCORE Address:", WCORE_ADDRESS);
  console.log("- Network: Core Testnet2 (chainId: 1114)");
  
  try {
    console.log("\n🏗️  Starting deployment...");
    
    // 1. Deploy Factory
    console.log("1️⃣  Deploying ChainCraftFactoryLite...");
    const FactoryContract = await ethers.getContractFactory("ChainCraftFactoryLite");
    const factory = await FactoryContract.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("✅ Factory deployed to:", factoryAddress);
    
    // 2. Deploy Governance
    console.log("\n2️⃣  Deploying Governance contracts...");
    const GovernanceContract = await ethers.getContractFactory("ChainCraftGovernance");
    const governance = await GovernanceContract.deploy();
    await governance.waitForDeployment();
    const governanceAddress = await governance.getAddress();
    console.log("✅ Governance deployed to:", governanceAddress);
    
    // 3. Deploy Airdrop
    console.log("\n3️⃣  Deploying Airdrop contract...");
    const AirdropContract = await ethers.getContractFactory("ChainCraftGovernanceAirdrop");
    const airdrop = await AirdropContract.deploy(governanceAddress); // Pass governance address
    await airdrop.waitForDeployment();
    const airdropAddress = await airdrop.getAddress();
    console.log("✅ Airdrop deployed to:", airdropAddress);
    
    // Skip DEX Manager for now as it requires actual DEX infrastructure
    console.log("\n⚠️  Skipping DEX Manager deployment (requires Core testnet2 DEX infrastructure)");
    const dexManagerAddress = "0x0000000000000000000000000000000000000000"; // Placeholder
    
    // Summary
    console.log("\n🎉 Core Contracts Deployment Complete!");
    console.log("=".repeat(70));
    console.log("📋 Contract Addresses (Core Testnet2 - ChainID: 1114):");
    console.log("=".repeat(70));
    console.log("Factory:      ", factoryAddress);
    console.log("Governance:   ", governanceAddress);  
    console.log("Airdrop:      ", airdropAddress);
    console.log("DEX Manager:  ", dexManagerAddress, "(placeholder - needs DEX infrastructure)");
    console.log("WCORE:        ", WCORE_ADDRESS);
    console.log("=".repeat(70));
    
    console.log("\n📝 Next steps:");
    console.log("1. Update src/lib/contracts/addresses.ts with these addresses");
    console.log("2. Find Core testnet2 DEX infrastructure addresses");
    console.log("3. Deploy DEX Manager with proper addresses");
    console.log("4. Test your contracts on Core testnet2");
    
    // Create addresses update snippet
    console.log("\n📋 Copy this to your addresses.ts file (chainId 1114):");
    console.log(`
    1114: {
      CHAINCRAFT_FACTORY: '${factoryAddress}',
      CHAINCRAFT_GOVERNANCE: '${governanceAddress}',
      CHAINCRAFT_DEX_MANAGER: '${dexManagerAddress}', // Update when DEX Manager is deployed
      CHAINCRAFT_AIRDROP: '${airdropAddress}',
      WETH: '${WCORE_ADDRESS}',
    },`);
    
    console.log("\n🌐 Verify contracts on explorer:");
    console.log(`- Factory: https://scan.test2.btcs.network/address/${factoryAddress}`);
    console.log(`- Governance: https://scan.test2.btcs.network/address/${governanceAddress}`);
    console.log(`- Airdrop: https://scan.test2.btcs.network/address/${airdropAddress}`);
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
