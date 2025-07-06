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
} = process.env;

// Ensure environment variables are defined
if (!PRIVATE_KEY) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}

if (!API_URL_sepolia) {
  throw new Error("Please set your API_URL_sepolia in a .env file");
}

if (!ETHERSCAN_API_KEY) {
  throw new Error("Please set your ETHERSCAN_API_KEY in a .env file");
}
if (!API_URL_basesepolia) {
  throw new Error("Please set your ETHERSCAN_API_KEY in a .env file");
}
if (!BASESCAN_API_KEY) {
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
    },
  },
  networks: {
    sepolia: {
      url: API_URL_sepolia,
      accounts: [PRIVATE_KEY!],
    },
    baseSepolia: {
      url: API_URL_basesepolia,
      accounts: [PRIVATE_KEY!],
    },
    base: {
      url: API_URL_base,
      accounts: [PRIVATE_KEY!],
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY as string,
      base: BASESCAN_API_KEY as string,
      baseSepolia: BASESCAN_API_KEY as string,
    },
  },
};

export default config;
