const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Deploying Token...");

  // Load deployed contract addresses
  let deploymentData;
  try {
    deploymentData = JSON.parse(fs.readFileSync("pumpfun-deployments.json", "utf8"));
  } catch (error) {
    console.error("❌ Could not load pumpfun-deployments.json");
    console.error("   Please run deployment script first: npx hardhat run scripts/deploy-pumpfun.js --network localhost");
    process.exit(1);
  }

  const factoryAddress = deploymentData.contracts.PumpFunFactoryLite;
  if (!factoryAddress) {
    console.error("❌ PumpFunFactoryLite address not found in pumpfun-deployments.json");
    process.exit(1);
  }

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("🏗️ Deployer:", deployer.address);

  // Get factory contract instance
  let factory;
  try {
    factory = await ethers.getContractAt("PumpFunFactoryLite", factoryAddress);
    const code = await ethers.provider.getCode(factoryAddress);
    if (code === "0x") {
      console.error("❌ No contract found at PumpFunFactoryLite address:", factoryAddress);
      process.exit(1);
    }
    console.log("✅ Factory contract loaded at:", factoryAddress);
  } catch (error) {
    console.error("❌ Error loading PumpFunFactoryLite contract:", error.message);
    process.exit(1);
  }

  // Token parameters
  const tokenName = "DUMPERTOKEN";
  const tokenSymbol = "DPK";
  const totalSupply = 1000000; // 1M tokens
  const liquidityLockPeriodDays = 30;
  const etherFee = ethers.parseEther("0.05"); // Matches contract's default fee

  // Deploy token
  console.log("🔧 Deploying token with parameters:");
  console.log(`  Name: ${tokenName}`);
  console.log(`  Symbol: ${tokenSymbol}`);
  console.log(`  Total Supply: ${totalSupply}`);
  console.log(`  Liquidity Lock Period: ${liquidityLockPeriodDays} days`);
  console.log(`  Ether Fee: ${ethers.formatEther(etherFee)} ETH`);

  let tx;
  try {
    tx = await factory.deployToken(tokenName, tokenSymbol, totalSupply, liquidityLockPeriodDays, {
      value: etherFee,
    });
    const receipt = await tx.wait();
    console.log("✅ Token Deployed!");

    // Parse TokenDeployed event to get token address
    const tokenDeployedEvent = receipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log && log.name === "TokenDeployed");

    if (tokenDeployedEvent) {
      console.log("📋 TokenDeployed Event:");
      console.log(`  Token Address: ${tokenDeployedEvent.args.tokenAddress}`);
      console.log(`  Creator: ${tokenDeployedEvent.args.creator}`);
    } else {
      console.log("⚠️ No TokenDeployed event found");
    }
  } catch (error) {
    console.error("❌ Token deployment failed:", error.message);
    process.exit(1);
  }

  // Get deployed token address
  try {
    const tokens = await factory.getTokensByCreator(deployer.address);
    if (tokens.length === 0) {
      console.log("⚠️ No tokens found for creator:", deployer.address);
    } else {
      const tokenAddress = tokens[tokens.length - 1];
      console.log(`📄 Token Address: ${tokenAddress}`);
      // Verify token contract
      const token = await ethers.getContractAt("PumpFunToken", tokenAddress);
      const name = await token.name();
      const symbol = await token.symbol();
      console.log(`✅ Verified Token - Name: ${name}, Symbol: ${symbol}`);
    }
  } catch (error) {
    console.error("❌ Failed to fetch creator tokens:", error.message);
    console.error("   Ensure 'getTokensByCreator' is correctly defined in PumpFunFactoryLite.sol");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });