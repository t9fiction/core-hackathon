const hre = require("hardhat");

async function main() {
  console.log("Network config:", hre.network.config);
  
  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer address:", await signer.getAddress());
  
  // Check the current gas price from the network
  const gasPrice = await hre.ethers.provider.getGasPrice();
  console.log("Current network gas price:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");
  
  // Get fee data (EIP-1559)
  const feeData = await hre.ethers.provider.getFeeData();
  console.log("Fee data:", {
    gasPrice: feeData.gasPrice ? hre.ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : null,
    maxFeePerGas: feeData.maxFeePerGas ? hre.ethers.formatUnits(feeData.maxFeePerGas, "gwei") + " gwei" : null,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? hre.ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei" : null,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
