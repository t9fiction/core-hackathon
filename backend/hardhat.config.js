require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  PRIVATE_KEY,
  API_URL_sepolia,
  ETHERSCAN_API_KEY,
  API_URL_basesepolia,
  API_URL_base,
  BASESCAN_API_KEY,
  MAIN_PRIVATE_KEY,
  CORE_TESTNET_API_KEY,
  CORE_MAINNET_API_KEY,
} = process.env;

// Ensure environment variables are defined
if (!PRIVATE_KEY) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}
if (!MAIN_PRIVATE_KEY) {
  throw new Error("Please set your MAIN_PRIVATE_KEY in a .env file");
}

if (!API_URL_sepolia) {
  throw new Error("Please set your API_URL_sepolia in a .env file");
}

if (!ETHERSCAN_API_KEY) {
  throw new Error("Please set your ETHERSCAN_API_KEY in a .env file");
}

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: API_URL_sepolia,
      accounts: [PRIVATE_KEY],
    },
    core_mainnet: {
      url: "https://rpc.coredao.org/",
      accounts: [MAIN_PRIVATE_KEY],
      chainId: 1116,
      gasPrice: 60000000000, // 60 gwei (includes priority fee)
      gas: 8000000,
      timeout: 60000,
    },
    core_testnet2: {
      url: "https://rpc.test2.btcs.network",
      accounts: [PRIVATE_KEY],
      chainId: 1114,
      gasPrice: 20000000000, // 20 gwei
      gas: 8000000,
      timeout: 60000,
      // EIP-1559 gas settings
      maxFeePerGas: 20000000000, // 20 gwei
      maxPriorityFeePerGas: 1000000000, // 1 gwei (minimum required)
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      ...(CORE_TESTNET_API_KEY && { core_testnet2: CORE_TESTNET_API_KEY }),
      ...(CORE_MAINNET_API_KEY && { core_mainnet: CORE_MAINNET_API_KEY }),
    },
    customChains: [
      {
        network: "core_mainnet",
        chainId: 1116,
        urls: {
          apiURL: "https://openapi.coredao.org/api",
          browserURL: "https://scan.coredao.org"
        }
      },
      {
        network: "core_testnet2",
        chainId: 1114,
        urls: {
          apiURL: "https://api.test2.btcs.network/api",
          browserURL: "https://scan.test2.btcs.network"
        }
      }
    ]
  },
};
