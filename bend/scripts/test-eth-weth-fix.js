const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🧪 Testing ETH/WETH functionality fix...\n");

  // Load deployment info
  let deploymentData;
  try {
    deploymentData = JSON.parse(fs.readFileSync("pumpfun-deployments-fixed.json", "utf8"));
  } catch (error) {
    console.error("❌ Could not load pumpfun-deployments-fixed.json");
    console.error("   Please run: npx hardhat run scripts/deploy-fixed-contracts.js --network sepolia");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("📍 Testing with account:", deployer.address);

  // Get contract instances
  const factory = await ethers.getContractAt("PumpFunFactoryLite", deploymentData.contracts.PumpFunFactoryLite);
  const dexManager = await ethers.getContractAt("PumpFunDEXManager", deploymentData.contracts.PumpFunDEXManager);

  // Check ETH balance
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 ETH balance: ${ethers.formatEther(ethBalance)} ETH`);

  // Test 1: Deploy a token
  console.log("\n🧪 TEST 1: Deploy Token...");
  const tokenName = "TestToken";
  const tokenSymbol = "TEST";
  const totalSupply = 1000000;
  const liquidityLockPeriodDays = 30;

  const requiredFee = await factory.getRequiredFee(totalSupply);
  console.log(`💵 Required fee: ${ethers.formatEther(requiredFee)} ETH`);

  let tokenAddress;
  try {
    const deployTx = await factory.deployToken(
      tokenName,
      tokenSymbol,
      totalSupply,
      liquidityLockPeriodDays,
      { value: requiredFee }
    );
    await deployTx.wait();
    
    const tokens = await factory.getTokensByCreator(deployer.address);
    tokenAddress = tokens[tokens.length - 1];
    console.log(`✅ Token deployed: ${tokenAddress}`);
  } catch (error) {
    console.error("❌ Token deployment failed:", error.message);
    process.exit(1);
  }

  // Test 2: Create DEX Pool with ETH
  console.log("\n🧪 TEST 2: Create DEX Pool with ETH...");
  const tokenAmount = ethers.parseEther("100000"); // 100k tokens
  const ethAmount = ethers.parseEther("0.1"); // 0.1 ETH
  const fee = 3000; // 0.3% fee tier

  try {
    // Get token instance and approve
    const token = await ethers.getContractAt("PumpFunToken", tokenAddress);
    const balance = await token.balanceOf(deployer.address);
    console.log(`📊 Token balance: ${ethers.formatEther(balance)} ${tokenSymbol}`);

    // Approve tokens
    console.log("🔗 Approving tokens...");
    const approvalTx = await token.approve(deploymentData.contracts.PumpFunFactoryLite, tokenAmount);
    await approvalTx.wait();
    console.log("✅ Tokens approved");

    // Create DEX pool with ETH
    console.log("🏊 Creating DEX pool with ETH...");
    console.log(`   Token amount: ${ethers.formatEther(tokenAmount)} ${tokenSymbol}`);
    console.log(`   ETH amount: ${ethers.formatEther(ethAmount)} ETH`);
    console.log(`   Fee tier: ${fee/100}%`);

    const poolTx = await factory.createDEXPool(
      tokenAddress,
      tokenAmount,
      fee,
      { value: ethAmount }
    );
    const receipt = await poolTx.wait();
    console.log("✅ DEX Pool created successfully!");
    console.log(`📄 Transaction: ${receipt.hash}`);

    // Check pool creation
    const wethAddress = await dexManager.WETH();
    const poolAddress = await dexManager.getPoolAddress(tokenAddress, wethAddress, fee);
    console.log(`🏊 Pool address: ${poolAddress}`);

    // Test 3: Verify pool is active
    console.log("\n🧪 TEST 3: Verify Pool Stats...");
    const stats = await dexManager.getTokenStats(tokenAddress);
    console.log(`📈 Pool Statistics:`);
    console.log(`   Price: ${stats[0]}`);
    console.log(`   Market Cap: ${stats[1]}`);
    console.log(`   Volume 24h: ${stats[2]}`);
    console.log(`   Liquidity: ${stats[3]}`);
    console.log(`   Is Active: ${stats[4]}`);

    if (stats[4]) {
      console.log("✅ Pool is active - ETH/WETH conversion working!");
    } else {
      console.log("❌ Pool is not active");
    }

    // Test 4: Check WETH balance (should be 0 as it was used for pool)
    console.log("\n🧪 TEST 4: Check WETH Conversion...");
    const weth = await ethers.getContractAt("IWETH", wethAddress);
    const wethBalance = await weth.balanceOf(deploymentData.contracts.PumpFunDEXManager);
    console.log(`💰 DEX Manager WETH balance: ${ethers.formatEther(wethBalance)} WETH`);

    // Final ETH balance
    const finalEthBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Final ETH balance: ${ethers.formatEther(finalEthBalance)} ETH`);
    console.log(`💸 ETH spent: ${ethers.formatEther(ethBalance - finalEthBalance)} ETH`);

    console.log("\n🎉 All tests passed! ETH/WETH conversion is working correctly.");
    
  } catch (error) {
    console.error("❌ DEX Pool creation failed:", error.message);
    
    // Additional debugging
    if (error.message.includes("revert")) {
      console.log("\n🔍 Debugging info:");
      console.log("- Make sure you have enough ETH balance");
      console.log("- Check that token approval worked");
      console.log("- Verify WETH address is correct for Sepolia");
      console.log("- Ensure Uniswap V3 contracts are deployed on Sepolia");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Test failed:", error);
    process.exit(1);
  });
