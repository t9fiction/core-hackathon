const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔧 Fixing deployment issues...\n");

  // Step 1: Check if hardhat node is running
  console.log("1. Checking hardhat node...");
  try {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Hardhat node is running (block: ${blockNumber})`);
  } catch (error) {
    console.log("❌ Hardhat node is not running");
    console.log("   Please start it with: npx hardhat node --fork <your-RPC-URL>");
    console.log("   Then run this script again");
    return;
  }

  // Step 2: Check deployment file
  console.log("\n2. Checking deployment file...");
  let deploymentExists = false;
  let deploymentData;
  
  try {
    deploymentData = JSON.parse(fs.readFileSync("pumpfun-deployments.json", "utf8"));
    deploymentExists = true;
    console.log("✅ Deployment file exists");
    
    // Validate deployment file structure
    if (!deploymentData.contracts || !deploymentData.contracts.PumpFunFactoryLite) {
      console.log("❌ Deployment file is corrupted or incomplete");
      deploymentExists = false;
    }
  } catch (error) {
    console.log("❌ Deployment file not found or corrupted");
    deploymentExists = false;
  }

  // Step 3: Re-deploy if needed
  if (!deploymentExists) {
    console.log("\n3. Re-deploying contracts...");
    try {
      const { spawn } = require("child_process");
      
      await new Promise((resolve, reject) => {
        const deployProcess = spawn("npx", ["hardhat", "run", "scripts/deploy-pumpfun.js", "--network", "localhost"], {
          stdio: "inherit"
        });
        
        deployProcess.on("close", (code) => {
          if (code === 0) {
            console.log("✅ Contracts deployed successfully");
            resolve();
          } else {
            reject(new Error(`Deployment failed with code ${code}`));
          }
        });
      });
      
      // Re-read deployment data
      deploymentData = JSON.parse(fs.readFileSync("pumpfun-deployments.json", "utf8"));
      
    } catch (error) {
      console.log("❌ Failed to re-deploy contracts:", error.message);
      return;
    }
  }

  // Step 4: Verify contracts are accessible
  console.log("\n4. Verifying contract accessibility...");
  const factoryAddress = deploymentData.contracts.PumpFunFactoryLite;
  
  try {
    const factory = await ethers.getContractAt("PumpFunFactoryLite", factoryAddress);
    const code = await ethers.provider.getCode(factoryAddress);
    
    if (code.length > 2) {
      console.log("✅ Factory contract is accessible");
      
      // Test a simple call
      const dexManager = await factory.dexManager();
      console.log(`✅ Factory functionality verified (DEX Manager: ${dexManager})`);
    } else {
      console.log("❌ Factory contract has no code");
    }
    
  } catch (error) {
    console.log("❌ Cannot access factory contract:", error.message);
  }

  // Step 5: Display final status
  console.log("\n🎯 Fix Summary:");
  console.log("================");
  console.log("✅ Hardhat node: Running");
  console.log(`✅ Deployment file: ${deploymentExists ? "Valid" : "Fixed"}`);
  console.log("✅ Contract addresses:");
  for (const [name, address] of Object.entries(deploymentData.contracts)) {
    console.log(`   ${name}: ${address}`);
  }
  
  console.log("\n🚀 You can now run:");
  console.log("   npx hardhat run scripts/deploy-token.js --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Fix failed:", error);
    process.exit(1);
  });
