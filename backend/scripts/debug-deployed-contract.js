const { ethers } = require("hardhat");

async function main() {
  console.log("=== Debugging Deployed PumpFunDEXManager ===");
  
  // Your deployed contract address
  const deployedAddress = "0x1a2F32A3F15f7e8B681A26f46C8AC79FecC118ec";
  
  // Get contract instance
  const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
  const pumpFunDEXManager = PumpFunDEXManager.attach(deployedAddress);
  
  console.log("Contract attached at:", deployedAddress);
  
  try {
    // Check contract configuration
    console.log("\n=== Contract Configuration ===");
    const swapRouter = await pumpFunDEXManager.swapRouter();
    const quoterV2 = await pumpFunDEXManager.quoterV2();
    const weth = await pumpFunDEXManager.WETH();
    const factory = await pumpFunDEXManager.uniswapV3Factory();
    
    console.log("SwapRouter:", swapRouter);
    console.log("QuoterV2:", quoterV2);
    console.log("WETH:", weth);
    console.log("UniswapV3Factory:", factory);
    
    // Verify addresses are contracts (not EOAs)
    console.log("\n=== Verifying Contract Addresses ===");
    const swapRouterCode = await ethers.provider.getCode(swapRouter);
    const quoterV2Code = await ethers.provider.getCode(quoterV2);
    const wethCode = await ethers.provider.getCode(weth);
    const factoryCode = await ethers.provider.getCode(factory);
    
    console.log("SwapRouter has code:", swapRouterCode !== "0x");
    console.log("QuoterV2 has code:", quoterV2Code !== "0x");
    console.log("WETH has code:", wethCode !== "0x");
    console.log("Factory has code:", factoryCode !== "0x");
    
    // Test with a known token (you'll need to replace this with an actual token address you've deployed)
    console.log("\n=== Testing Contract Functions ===");
    
    // You can add more specific tests here once we know what token you're trying to swap
    console.log("Contract debugging complete. Please provide:");
    console.log("1. The specific error message you're getting");
    console.log("2. The token address you're trying to swap");
    console.log("3. The transaction hash of the failed transaction");
    
  } catch (error) {
    console.error("Error debugging contract:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
