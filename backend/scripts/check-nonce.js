const hre = require("hardhat");

async function main() {
  const address = "0x804e2c4bb1f403557acfbc2d25941cfa6c226313";
  
  // Get current nonce
  const currentNonce = await hre.ethers.provider.getTransactionCount(address);
  console.log(`Current nonce for ${address}:`, currentNonce);
  
  // Get pending nonce
  const pendingNonce = await hre.ethers.provider.getTransactionCount(address, "pending");
  console.log(`Pending nonce for ${address}:`, pendingNonce);
  
  // Check if there are pending transactions
  if (currentNonce !== pendingNonce) {
    console.log(`There are ${pendingNonce - currentNonce} pending transactions.`);
  } else {
    console.log("No pending transactions found.");
  }
  
  // Get account balance
  const balance = await hre.ethers.provider.getBalance(address);
  console.log(`Balance:`, hre.ethers.formatEther(balance), "CORE");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
