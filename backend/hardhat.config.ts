import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const {
  PRIVATE_KEY,
  API_URL_sepolia,
  ETHERSCAN_API_KEY,
  API_URL_basesepolia,
  API_URL_base,
  BASESCAN_API_KEY,
  MAIN_PRIVATE_KEY,
} = process.env;

// Ensure environment variables are defined
if (!PRIVATE_KEY) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}
if(!MAIN_PRIVATE_KEY) {
  throw new Error("Please set your MAIN_PRIVATE_KEY in a .env file")
}

if (!API_URL_sepolia) {
  throw new Error("Please set your API_URL_sepolia in a .env file");
}

if (!ETHERSCAN_API_KEY) {
  throw new Error("Please set your ETHERSCAN_API_KEY in a .env file");
}

const config: HardhatUserConfig = {
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
      accounts: [PRIVATE_KEY!],
    },
    core_mainnet: {
      url: "https://rpc.coredao.org/",
      accounts: [MAIN_PRIVATE_KEY],
      chainId: 1116,
    },
    core_testnet2: {
      url: "https://rpc.test2.btcs.network",
      accounts: [PRIVATE_KEY],
      chainId: 1114,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY as string,
      // base: BASESCAN_API_KEY as string,
      // baseSepolia: BASESCAN_API_KEY as string,
    },
  },
};

export default config;
