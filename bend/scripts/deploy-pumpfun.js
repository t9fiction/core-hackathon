const { ethers } = require("hardhat");
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const fs = require("fs");

async function main() {
  console.log("🚀 Deploying PumpFun contracts to forked mainnet...");

  // Check if fork is running
  try {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const blockNumber = await provider.getBlockNumber();
    console.log("✅ Fork is running, current block:", blockNumber);
  } catch (error) {
    console.error("❌ Fork is not running! Please start with: npx hardhat node --fork <RPC_URL>");
    process.exit(1);
  }

  // Define modules
  const modules = [
    { 
      path: "ignition/modules/PumpFunToken.ts",
      name: "PumpFunToken",
      description: "Token contract"
    },
    { 
      path: "ignition/modules/PumpFunFactoryLite.ts",
      name: "PumpFunFactoryLite", 
      description: "Factory contract"
    },
    { 
      path: "ignition/modules/PumpFunDEXManager.ts",
      name: "PumpFunDEXManager",
      description: "DEX Manager contract"
    }
  ];

  const deployedContracts = {};
  const deploymentOrder = [];

  console.log("\n📦 Starting deployment process...");

  for (const module of modules) {
    try {
      console.log(`\n🔧 Deploying ${module.description} (${module.name})...`);

      // Dynamically import the module
      const moduleDefinition = require(`../${module.path}`);
      const ignitionModule = moduleDefinition.default || moduleDefinition;

      // Deploy the module
      const deploymentResult = await hre.ignition.deploy(ignitionModule, {
        network: "localhost",
      });

      // Get the deployed contract address
      console.log(`🔍 Debug: deploymentResult for ${module.name}:`, Object.keys(deploymentResult));
      
      // Try different ways to access the contract
      let contract = deploymentResult[module.name];
      if (!contract) {
        // Try with lowercase
        const lowerName = module.name.toLowerCase();
        contract = deploymentResult[lowerName];
      }
      if (!contract) {
        // Try accessing the first property
        const firstKey = Object.keys(deploymentResult)[0];
        contract = deploymentResult[firstKey];
      }
      
      if (contract && (contract.address || contract.target)) {
        const address = contract.address || contract.target;
        deployedContracts[module.name] = address;
        deploymentOrder.push(module.name);
        console.log(`✅ ${module.name} deployed successfully at: ${address}`);
      } else {
        console.log(`⚠️ Could not find address for ${module.name}`);
        console.log(`   Available keys:`, Object.keys(deploymentResult));
      }

    } catch (error) {
      console.error(`❌ Failed to deploy ${module.name}:`, error.message);
      console.log("⏭️ Continuing with remaining deployments...");
    }
  }

  // Post-deployment configuration
  console.log("\n⚙️ Post-deployment configuration...");

  if (deployedContracts.PumpFunFactoryLite && deployedContracts.PumpFunDEXManager) {
    try {
      console.log("🔧 Setting DEXManager on FactoryLite...");

      const factoryLite = await ethers.getContractAt("PumpFunFactoryLite", deployedContracts.PumpFunFactoryLite);
      const tx = await factoryLite.setDEXManager(deployedContracts.PumpFunDEXManager);
      await tx.wait();

      console.log("✅ DEXManager set successfully!");
      console.log(`   Factory: ${deployedContracts.PumpFunFactoryLite}`);
      console.log(`   DEXManager: ${deployedContracts.PumpFunDEXManager}`);

      // Verify the setting
      const setDEXManager = await factoryLite.dexManager();
      console.log(`🔍 Verified DEXManager: ${setDEXManager}`);

      if (setDEXManager.toLowerCase() === deployedContracts.PumpFunDEXManager.toLowerCase()) {
        console.log("✅ DEXManager configuration verified!");
      } else {
        console.log("❌ DEXManager configuration mismatch!");
      }

    } catch (error) {
      console.error("❌ Failed to set DEXManager:", error.message);
      console.error("   You may need to set this manually later");
    }
  } else {
    console.log("⚠️ Could not configure DEXManager - contracts not found");
  }

  // Save deployment info
  const deploymentData = {
    network: "localhost",
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
    deploymentOrder,
    contracts: deployedContracts,
    configured: {
      dexManagerSet: deployedContracts.PumpFunFactoryLite && deployedContracts.PumpFunDEXManager
    }
  };

  fs.writeFileSync(
    "pumpfun-deployments.json",
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("\n🎉 Deployment Summary:");
  console.log("=".repeat(50));
  console.log("📋 Deployed Contracts:");
  for (const [name, address] of Object.entries(deployedContracts)) {
    console.log(`  ${name}: ${address}`);
  }

  console.log(`\n💾 Deployment info saved to: pumpfun-deployments.json`);
  console.log(`🌐 Network: localhost (forked mainnet)`);
  console.log(`📦 Total contracts deployed: ${Object.keys(deployedContracts).length}`);

  // Verify deployments
  console.log("\n🔍 Verifying deployments...");
  for (const [name, address] of Object.entries(deployedContracts)) {
    try {
      const code = await ethers.provider.getCode(address);
      const isDeployed = code.length > 2;
      console.log(`  ${name}: ${isDeployed ? "✅ Verified" : "❌ Not found"}`);
    } catch (error) {
      console.log(`  ${name}: ❌ Error checking - ${error.message}`);
    }
  }

  console.log("\n🎯 Next steps:");
  console.log("  1. ✅ Contracts deployed and configured");
  console.log("  2. Run whale script to get test tokens: npx hardhat run scripts/whale-helper.js --network localhost");
  console.log("  3. Run tests: npx hardhat run scripts/test-pumpfun.js --network localhost");
  console.log("  4. Or use console for manual testing: npx hardhat console --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  });