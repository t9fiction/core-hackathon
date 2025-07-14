const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Deploying updated PumpFun contracts with ETH/WETH fix...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // Sepolia testnet addresses
  const SEPOLIA_ADDRESSES = {
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    UNISWAP_V3_FACTORY: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    SWAP_ROUTER: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    POSITION_MANAGER: "0x1238536071E1c677A632429e3655c799b22cDA52"
  };

  console.log("🔧 Using Sepolia addresses:");
  console.log("  WETH:", SEPOLIA_ADDRESSES.WETH);
  console.log("  Uniswap V3 Factory:", SEPOLIA_ADDRESSES.UNISWAP_V3_FACTORY);
  console.log("  Swap Router:", SEPOLIA_ADDRESSES.SWAP_ROUTER);
  console.log("  Position Manager:", SEPOLIA_ADDRESSES.POSITION_MANAGER);
  console.log();

  // Deploy DEX Manager
  console.log("🏗️  Deploying PumpFunDEXManager...");
  const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
  const dexManager = await PumpFunDEXManager.deploy(
    SEPOLIA_ADDRESSES.SWAP_ROUTER,
    SEPOLIA_ADDRESSES.POSITION_MANAGER,
    SEPOLIA_ADDRESSES.UNISWAP_V3_FACTORY,
    SEPOLIA_ADDRESSES.WETH
  );
  await dexManager.waitForDeployment();
  console.log("✅ PumpFunDEXManager deployed to:", await dexManager.getAddress());

  // Deploy Factory
  console.log("🏗️  Deploying PumpFunFactoryLite...");
  const PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
  const factory = await PumpFunFactoryLite.deploy();
  await factory.waitForDeployment();
  console.log("✅ PumpFunFactoryLite deployed to:", await factory.getAddress());

  // Connect DEX Manager to Factory
  console.log("🔗 Connecting DEX Manager to Factory...");
  const setDEXManagerTx = await factory.setDEXManager(await dexManager.getAddress());
  await setDEXManagerTx.wait();
  console.log("✅ DEX Manager connected to Factory");

  const setFactoryTx = await dexManager.setFactory(await factory.getAddress());
  await setFactoryTx.wait();
  console.log("✅ Factory connected to DEX Manager");

  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PumpFunDEXManager: await dexManager.getAddress(),
      PumpFunFactoryLite: await factory.getAddress()
    },
    addresses: SEPOLIA_ADDRESSES,
    fixes: [
      "Added ETH-to-WETH conversion support",
      "Fixed createDEXPool to handle ETH automatically",
      "Added createLiquidityPoolWithETH function",
      "Fixed token tracking in liquidity pools"
    ]
  };

  fs.writeFileSync("pumpfun-deployments-fixed.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved to pumpfun-deployments-fixed.json");

  console.log("\n🎉 All contracts deployed successfully!");
  console.log("📋 Summary:");
  console.log("  - PumpFunDEXManager:", await dexManager.getAddress());
  console.log("  - PumpFunFactoryLite:", await factory.getAddress());
  console.log("  - Network: Sepolia");
  console.log("  - ETH/WETH conversion: ✅ Fixed");
  console.log("  - createDEXPool: ✅ Now supports ETH");
  
  console.log("\n🔧 Next steps:");
  console.log("1. Test the createDEXPool function with ETH");
  console.log("2. Verify that WETH conversion happens automatically");
  console.log("3. Check that liquidity pools are created correctly");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  });
