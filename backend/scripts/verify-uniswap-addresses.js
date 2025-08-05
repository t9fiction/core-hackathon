const { ethers } = require("hardhat");

async function main() {
  console.log("=== Verifying Uniswap V3 Addresses on Sepolia ===");
  
  const addresses = {
    "SwapRouter (Correct)": "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    "SwapRouter (Your Current)": "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
    "PositionManager": "0x1238536071E1c677A632429e3655c799b22cDA52",
    "Factory": "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    "QuoterV2": "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
    "WETH": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
  };
  
  for (const [name, address] of Object.entries(addresses)) {
    try {
      const code = await ethers.provider.getCode(address);
      const hasCode = code !== "0x";
      console.log(`${name}: ${address} -> ${hasCode ? "✅ EXISTS" : "❌ NOT FOUND"}`);
    } catch (error) {
      console.log(`${name}: ${address} -> ❌ ERROR: ${error.message}`);
    }
  }
  
  console.log("\n=== Recommendation ===");
  console.log("You need to redeploy with the correct SwapRouter address:");
  console.log("0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
