const hre = require("hardhat");

async function main() {
  console.log("Deploying ChainCraft Protocol to Core DAO Mainnet...");
  
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
  
  // Deploy ChainCraftGovernance
  console.log("\nDeploying ChainCraftGovernance...");
  const ChainCraftGovernance = await hre.ethers.getContractFactory("ChainCraftGovernance");
  const governance = await ChainCraftGovernance.deploy(gasSettings);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("ChainCraftGovernance deployed to:", governanceAddress);
  
  // Deploy ChainCraftGovernanceAirdrop
  console.log("\nDeploying ChainCraftGovernanceAirdrop...");
  const ChainCraftGovernanceAirdrop = await hre.ethers.getContractFactory("ChainCraftGovernanceAirdrop");
  const airdrop = await ChainCraftGovernanceAirdrop.deploy(governanceAddress, gasSettings);
  await airdrop.waitForDeployment();
  const airdropAddress = await airdrop.getAddress();
  console.log("ChainCraftGovernanceAirdrop deployed to:", airdropAddress);
  
  // SushiSwap RouteProcessor7 addresses for Core DAO mainnet
  const SUSHI_SWAP_ROUTER = "0x3ced11c610556e5292fbc2e75d68c3899098c14c";
  const WCORE = "0x40375c92d9faf44d2f9db9bd9ba41a3317a2404f";
  
  // Deploy ChainCraftDEXManager
  console.log("\nDeploying ChainCraftDEXManager...");
  const ChainCraftDEXManager = await hre.ethers.getContractFactory("ChainCraftDEXManager");
  const dexManager = await ChainCraftDEXManager.deploy(SUSHI_SWAP_ROUTER, WCORE, gasSettings);
  await dexManager.waitForDeployment();
  const dexManagerAddress = await dexManager.getAddress();
  console.log("ChainCraftDEXManager deployed to:", dexManagerAddress);
  
  // Deploy ChainCraftFactoryLite
  console.log("\nDeploying ChainCraftFactoryLite...");
  const ChainCraftFactoryLite = await hre.ethers.getContractFactory("ChainCraftFactoryLite");
  const factory = await ChainCraftFactoryLite.deploy(gasSettings);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("ChainCraftFactoryLite deployed to:", factoryAddress);
  
  // Set up relationships between contracts
  console.log("\nSetting up contract relationships...");
  
  console.log("Setting factory on DEX manager...");
  const setFactoryTx = await dexManager.setFactory(factoryAddress, gasSettings);
  await setFactoryTx.wait();
  console.log("Factory set on DEX manager");
  
  console.log("Setting DEX manager on factory...");
  const setDEXManagerTx = await factory.setDEXManager(dexManagerAddress, gasSettings);
  await setDEXManagerTx.wait();
  console.log("DEX manager set on factory");
  
  console.log("\n=== Deployment Summary ===");
  console.log("ChainCraftGovernance:", governanceAddress);
  console.log("ChainCraftGovernanceAirdrop:", airdropAddress);
  console.log("ChainCraftDEXManager:", dexManagerAddress);
  console.log("ChainCraftFactoryLite:", factoryAddress);
  console.log("\nSushiSwap Router:", SUSHI_SWAP_ROUTER);
  console.log("WCORE Token:", WCORE);
  
  console.log("\n=== Verification Commands ===");
  console.log(`npx hardhat verify --network core_mainnet ${governanceAddress}`);
  console.log(`npx hardhat verify --network core_mainnet ${airdropAddress} ${governanceAddress}`);
  console.log(`npx hardhat verify --network core_mainnet ${dexManagerAddress} ${SUSHI_SWAP_ROUTER} ${WCORE}`);
  console.log(`npx hardhat verify --network core_mainnet ${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
