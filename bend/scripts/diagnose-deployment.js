const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔍 Diagnosing deployment issues...\n");

  // Check 1: Deployment file exists
  console.log("1. Checking deployment file...");
  let deploymentData;
  try {
    deploymentData = JSON.parse(fs.readFileSync("pumpfun-deployments.json", "utf8"));
    console.log("✅ pumpfun-deployments.json exists");
    console.log(`   Network: ${deploymentData.network}`);
    console.log(`   Timestamp: ${deploymentData.timestamp}`);
  } catch (error) {
    console.log("❌ pumpfun-deployments.json not found or corrupted");
    console.log("   Solution: Run 'npx hardhat run scripts/deploy-pumpfun.js --network localhost' first");
    return;
  }

  // Check 2: Network connectivity
  console.log("\n2. Checking network connectivity...");
  try {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Network connected, block: ${blockNumber}`);
  } catch (error) {
    console.log("❌ Cannot connect to localhost:8545");
    console.log("   Solution: Start hardhat node with 'npx hardhat node --fork <RPC_URL>'");
    return;
  }

  // Check 3: Contract addresses exist
  console.log("\n3. Checking contract addresses...");
  const requiredContracts = ["PumpFunToken", "PumpFunFactoryLite", "PumpFunDEXManager"];
  
  for (const contractName of requiredContracts) {
    const address = deploymentData.contracts[contractName];
    if (!address) {
      console.log(`❌ ${contractName} address not found in deployment file`);
      continue;
    }
    
    try {
      const code = await ethers.provider.getCode(address);
      if (code.length > 2) {
        console.log(`✅ ${contractName}: ${address} (deployed)`);
      } else {
        console.log(`❌ ${contractName}: ${address} (no code found)`);
      }
    } catch (error) {
      console.log(`❌ ${contractName}: ${address} (error: ${error.message})`);
    }
  }

  // Check 4: Try to load factory contract
  console.log("\n4. Testing factory contract loading...");
  const factoryAddress = deploymentData.contracts.PumpFunFactoryLite;
  if (factoryAddress) {
    try {
      const factory = await ethers.getContractAt("PumpFunFactoryLite", factoryAddress);
      const dexManager = await factory.dexManager();
      console.log(`✅ Factory contract loaded successfully`);
      console.log(`   DEX Manager: ${dexManager}`);
    } catch (error) {
      console.log(`❌ Failed to load factory contract: ${error.message}`);
    }
  }

  console.log("\n🎯 Diagnosis complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Diagnosis failed:", error);
    process.exit(1);
  });
