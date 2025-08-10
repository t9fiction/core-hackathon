const { ethers } = require("hardhat");

async function main() {
  const FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const factory = await ethers.getContractAt("ChainCraftFactoryLite", FACTORY_ADDRESS);

  console.log("Supply tier limits:");
  console.log("STANDARD MAX:", (await factory.STANDARD_MAX_SUPPLY()).toString());
  console.log("PREMIUM MAX:", (await factory.PREMIUM_MAX_SUPPLY()).toString()); 
  console.log("ULTIMATE MAX:", (await factory.ULTIMATE_MAX_SUPPLY()).toString());
  
  console.log("\nIn human readable format:");
  console.log("STANDARD MAX:", ethers.formatEther(await factory.STANDARD_MAX_SUPPLY()));
  console.log("PREMIUM MAX:", ethers.formatEther(await factory.PREMIUM_MAX_SUPPLY()));
  console.log("ULTIMATE MAX:", ethers.formatEther(await factory.ULTIMATE_MAX_SUPPLY()));
}

main().catch(console.error);
