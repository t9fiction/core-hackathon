const hre = require("hardhat");
const { ethers } = require("hardhat");
const { parseEther } = require("viem");

async function main() {
  console.log("🚀 Deploying sample tokens for testing...\n");

  const [deployer, user1, user2, user3] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);
  
  // Factory address from the deployment
  const FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  const factory = await ethers.getContractAt("PumpFunFactoryLite", FACTORY_ADDRESS);
  
  // Sample tokens to deploy (using raw numbers without parseEther since contract expects raw amounts)
  const sampleTokens = [
    {
      name: "DogeCoin 2.0",
      symbol: "DOGE2",
      supply: 50000000, // 50M tokens (standard tier)
      signer: deployer
    },
    {
      name: "PepeCoin",
      symbol: "PEPE",
      supply: 80000000, // 80M tokens (standard tier)
      signer: user1
    },
    {
      name: "ShibaToken",
      symbol: "SHIB",
      supply: 300000000, // 300M tokens (premium tier)
      signer: user2
    },
    {
      name: "MoonCoin",
      symbol: "MOON",
      supply: 750000000, // 750M tokens (ultimate tier)
      signer: user3
    },
    {
      name: "RocketToken",
      symbol: "ROCKET",
      supply: 25000000, // 25M tokens (standard tier)
      signer: deployer
    }
  ];

  const deployedTokens = [];

  for (let i = 0; i < sampleTokens.length; i++) {
    const token = sampleTokens[i];
    console.log(`📝 Deploying token ${i + 1}/5: ${token.name} (${token.symbol})...`);
    
    try {
      // Calculate required fee
      const requiredFee = await factory.getRequiredFee(token.supply);
      console.log(`   Fee required: ${ethers.formatEther(requiredFee)} ETH`);
      
      // Deploy token with the correct signer
      const tx = await factory.connect(token.signer).deployToken(
        token.name,
        token.symbol, 
        token.supply,
        {
          value: requiredFee,
          gasLimit: 1000000
        }
      );
      
      const receipt = await tx.wait();
      
      // Find the TokenDeployed event
      const event = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed && parsed.name === 'TokenDeployed';
        } catch (e) {
          return false;
        }
      });
      
      if (event) {
        const parsed = factory.interface.parseLog(event);
        const tokenAddress = parsed.args.tokenAddress;
        
        console.log(`   ✅ Token deployed at: ${tokenAddress}`);
        console.log(`   📊 Supply: ${token.supply.toLocaleString()} tokens`);
        console.log(`   👤 Creator: ${token.signer.address}\n`);
        
        deployedTokens.push({
          name: token.name,
          symbol: token.symbol,
          address: tokenAddress,
          creator: token.signer.address,
          supply: token.supply
        });
      } else {
        console.log("   ❌ Could not find TokenDeployed event\n");
      }
      
    } catch (error) {
      console.error(`   ❌ Error deploying ${token.name}:`, error.message, "\n");
    }
  }

  // Get all deployed tokens from factory
  console.log("📋 Fetching all deployed tokens from factory...");
  const allTokens = await factory.getAllDeployedTokens();
  console.log(`✅ Total tokens in factory: ${allTokens.length}`);
  
  for (let i = 0; i < allTokens.length; i++) {
    const tokenAddress = allTokens[i];
    try {
      const tokenInfo = await factory.getTokenInfo(tokenAddress);
      const tokenContract = await ethers.getContractAt("PumpFunToken", tokenAddress);
      const name = await tokenContract.name();
      const symbol = await tokenContract.symbol();
      
      console.log(`   ${i + 1}. ${name} (${symbol}) - ${tokenAddress}`);
      console.log(`      Creator: ${tokenInfo[0]}`);
      console.log(`      Deployed: ${new Date(Number(tokenInfo[1]) * 1000).toLocaleString()}`);
    } catch (error) {
      console.log(`   ${i + 1}. ${tokenAddress} - Error getting details: ${error.message}`);
    }
  }

  console.log("\n🎉 Sample token deployment complete!");
  console.log("🌐 Make sure your frontend is connected to localhost network (chain ID: 31337)");
  console.log("💡 You should now see these tokens on your homepage!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
