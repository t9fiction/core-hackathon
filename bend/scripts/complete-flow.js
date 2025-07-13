const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Starting complete PumpFun token deployment and DEX pool creation flow...\n");

  // Check if deployment exists
  let deploymentData;
  try {
    deploymentData = JSON.parse(fs.readFileSync("pumpfun-deployments.json", "utf8"));
  } catch (error) {
    console.error("❌ Could not load pumpfun-deployments.json");
    console.error("   Please run: npx hardhat run scripts/deploy-pumpfun.js --network localhost");
    process.exit(1);
  }

  // Get contract instances
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractAt("PumpFunFactoryLite", deploymentData.contracts.PumpFunFactoryLite);
  const dexManager = await ethers.getContractAt("PumpFunDEXManager", deploymentData.contracts.PumpFunDEXManager);

  console.log("📍 Deployer address:", deployer.address);
  console.log("🏭 Factory address:", deploymentData.contracts.PumpFunFactoryLite);
  console.log("🔄 DEX Manager address:", deploymentData.contracts.PumpFunDEXManager);

  // Check ETH balance
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 ETH balance: ${ethers.formatEther(ethBalance)} ETH\n`);

  // STEP 1: Deploy Token
  console.log("📦 STEP 1: Deploying Token...");
  
  const tokenName = "PumpToken";
  const tokenSymbol = "PUMP";
  const totalSupply = 1000000; // 1M tokens
  const liquidityLockPeriodDays = 30;
  
  // Calculate required fee
  const requiredFee = await factory.getRequiredFee(totalSupply);
  console.log(`💵 Required fee: ${ethers.formatEther(requiredFee)} ETH`);

  let tokenAddress;
  try {
    console.log("🔧 Deploying token...");
    const deployTx = await factory.deployToken(
      tokenName,
      tokenSymbol,
      totalSupply,
      liquidityLockPeriodDays,
      { value: requiredFee }
    );
    const receipt = await deployTx.wait();
    console.log("✅ Token deployed successfully!");
    console.log(`📄 Transaction hash: ${receipt.hash}`);

    // Get deployed token address
    const tokens = await factory.getTokensByCreator(deployer.address);
    tokenAddress = tokens[tokens.length - 1];
    console.log(`🪙 Token address: ${tokenAddress}`);

    // Get token instance and check details
    const token = await ethers.getContractAt("PumpFunToken", tokenAddress);
    const name = await token.name();
    const symbol = await token.symbol();
    const supply = await token.totalSupply();
    const balance = await token.balanceOf(deployer.address);
    
    console.log(`📊 Token details:`);
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Total Supply: ${ethers.formatEther(supply)}`);
    console.log(`   Your Balance: ${ethers.formatEther(balance)}`);

  } catch (error) {
    console.error("❌ Token deployment failed:", error.message);
    process.exit(1);
  }

  // STEP 2: Create DEX Pool
  console.log("\n🏊 STEP 2: Creating DEX Pool...");
  
  const tokenAmount = ethers.parseEther("100000"); // 100k tokens for liquidity
  const ethAmount = ethers.parseEther("1"); // 1 ETH
  const fee = 3000; // 0.3% fee tier

  try {
    // Get token instance
    const token = await ethers.getContractAt("PumpFunToken", tokenAddress);
    const balance = await token.balanceOf(deployer.address);
    
    // Check if we have enough tokens
    if (balance < tokenAmount) {
      console.log("❌ Insufficient token balance for liquidity provision");
      console.log(`   Required: ${ethers.formatEther(tokenAmount)}`);
      console.log(`   Available: ${ethers.formatEther(balance)}`);
      process.exit(1);
    }

    // Approve tokens for the factory
    console.log("🔗 Approving tokens for factory...");
    const approvalTx = await token.approve(deploymentData.contracts.PumpFunFactoryLite, tokenAmount);
    await approvalTx.wait();
    console.log("✅ Tokens approved!");

    // Create DEX pool
    console.log("🏊 Creating DEX pool...");
    console.log(`   Token amount: ${ethers.formatEther(tokenAmount)} ${tokenSymbol}`);
    console.log(`   ETH amount: ${ethers.formatEther(ethAmount)} ETH`);
    console.log(`   Fee tier: ${fee/100}%`);

    const poolTx = await factory.createDEXPool(
      tokenAddress,
      tokenAmount,
      fee,
      { value: ethAmount }
    );
    const poolReceipt = await poolTx.wait();
    console.log("✅ DEX Pool created successfully!");
    console.log(`📄 Pool creation transaction: ${poolReceipt.hash}`);

    // Get pool address
    const wethAddress = await dexManager.WETH();
    const poolAddress = await dexManager.getPoolAddress(tokenAddress, wethAddress, fee);
    console.log(`🏊 Pool address: ${poolAddress}`);

  } catch (error) {
    console.error("❌ DEX Pool creation failed:", error.message);
    process.exit(1);
  }

  // STEP 3: Verify Pool Creation
  console.log("\n📊 STEP 3: Verifying Pool...");
  
  try {
    const stats = await dexManager.getTokenStats(tokenAddress);
    console.log(`📈 Pool Statistics:`);
    console.log(`   Price: ${stats[0]}`);
    console.log(`   Market Cap: ${stats[1]}`);
    console.log(`   Volume 24h: ${stats[2]}`);
    console.log(`   Liquidity: ${stats[3]}`);
    console.log(`   Is Active: ${stats[4]}`);

    if (stats[4]) {
      console.log("✅ Pool is active and ready for trading!");
    } else {
      console.log("⚠️ Pool is not active");
    }

  } catch (error) {
    console.log("⚠️ Could not fetch pool stats:", error.message);
  }

  // STEP 4: Final Summary
  console.log("\n💰 STEP 4: Final Summary...");
  const finalEthBalance = await ethers.provider.getBalance(deployer.address);
  const token = await ethers.getContractAt("PumpFunToken", tokenAddress);
  const finalTokenBalance = await token.balanceOf(deployer.address);
  
  console.log(`📊 Final Balances:`);
  console.log(`   ETH: ${ethers.formatEther(finalEthBalance)} ETH`);
  console.log(`   ${tokenSymbol}: ${ethers.formatEther(finalTokenBalance)} ${tokenSymbol}`);

  console.log("\n🎉 Complete flow executed successfully!");
  console.log("🎯 Your token is now deployed and has a DEX pool for trading!");
  console.log("\n🔧 Next steps:");
  console.log("  1. Your token is now tradeable on Uniswap V3");
  console.log("  2. Users can swap ETH for your token");
  console.log("  3. Liquidity is locked for 30 days");
  console.log("  4. Use the pool address for frontend integration");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Flow failed:", error);
    process.exit(1);
  });
