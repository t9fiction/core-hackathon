const hre = require("hardhat");

async function main() {
  console.log("Redeploying ChainCraftDEXManager with new WCORE address...");
  
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", await deployer.getAddress());
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "CORE");
  
  // Gas settings that should work with Core DAO
  const gasSettings = {
    gasLimit: 8000000,
    maxFeePerGas: hre.ethers.parseUnits("60", "gwei"),
    maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei"),
  };
  
  console.log("Using gas settings:", {
    gasLimit: gasSettings.gasLimit,
    maxFeePerGas: hre.ethers.formatUnits(gasSettings.maxFeePerGas, "gwei") + " gwei",
    maxPriorityFeePerGas: hre.ethers.formatUnits(gasSettings.maxPriorityFeePerGas, "gwei") + " gwei",
  });
  
  // New WCORE address from the ChainCraftDEXManager.ts file
  const NEW_WCORE = "0x191e94fa59739e188dce837f7f6978d84727ad01";
  const SUSHI_SWAP_ROUTER = "0x3ced11c610556e5292fbc2e75d68c3899098c14c";
  
  console.log("\\nDeployment parameters:");
  console.log("SUSHI_SWAP_ROUTER:", SUSHI_SWAP_ROUTER);
  console.log("NEW_WCORE:", NEW_WCORE);
  
  // Deploy new ChainCraftDEXManager
  console.log("\\nDeploying new ChainCraftDEXManager...");
  const ChainCraftDEXManager = await hre.ethers.getContractFactory("ChainCraftDEXManager");
  const newDexManager = await ChainCraftDEXManager.deploy(SUSHI_SWAP_ROUTER, NEW_WCORE, gasSettings);
  await newDexManager.waitForDeployment();
  const newDexManagerAddress = await newDexManager.getAddress();
  console.log("New ChainCraftDEXManager deployed to:", newDexManagerAddress);
  
  // Previous contract addresses
  const FACTORY_ADDRESS = "0x322ae249923d378a7a92Cc58C578DaC6270d6b4b";
  const OLD_DEX_MANAGER_ADDRESS = "0xe93815D756a8EA242C9222d9420E3E7A7b074241";
  
  console.log("\\nUpdating contract relationships...");
  
  // Set up relationships with existing factory
  console.log("Setting factory on new DEX manager...");
  const setFactoryTx = await newDexManager.setFactory(FACTORY_ADDRESS, gasSettings);
  await setFactoryTx.wait();
  console.log("Factory set on new DEX manager");
  
  // Update factory to use new DEX manager
  console.log("Setting new DEX manager on factory...");
  const ChainCraftFactoryLite = await hre.ethers.getContractFactory("ChainCraftFactoryLite");
  const factory = ChainCraftFactoryLite.attach(FACTORY_ADDRESS);
  const setDEXManagerTx = await factory.setDEXManager(newDexManagerAddress, gasSettings);
  await setDEXManagerTx.wait();
  console.log("New DEX manager set on factory");
  
  console.log("\\n=== Redeployment Summary ===");
  console.log("Old ChainCraftDEXManager:", OLD_DEX_MANAGER_ADDRESS);
  console.log("New ChainCraftDEXManager:", newDexManagerAddress);
  console.log("Factory (updated):", FACTORY_ADDRESS);
  console.log("\\nOld WCORE:", "0x40375c92d9faf44d2f9db9bd9ba41a3317a2404f");
  console.log("New WCORE:", NEW_WCORE);
  console.log("SushiSwap Router:", SUSHI_SWAP_ROUTER);
  
  console.log("\\n=== Verification Command ===");
  console.log(`npx hardhat verify --network core_mainnet ${newDexManagerAddress} ${SUSHI_SWAP_ROUTER} ${NEW_WCORE}`);
  
  console.log("\\n⚠️ Important Notes:");
  console.log("- The old DEX manager is no longer connected to the factory");
  console.log("- All future token operations will use the new WCORE address");
  console.log("- Make sure to update any frontend or scripts to use the new DEX manager address");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
