// SushiSwap V3 Factory and Position Manager addresses by chain ID
export const SUSHISWAP_V3_ADDRESSES: Record<number, { factory: string; positionManager: string }> = {
  // Ethereum Mainnet (SushiSwap V3)
  1: {
    factory: "0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F",
    positionManager: "0x2214A42d8e2A1d20635c2cb0664422c528B6A432",
  },
  // Sepolia Testnet (Uniswap V3 for testing)
  11155111: {
    factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    positionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
  },
  // Base (SushiSwap V3)
  8453: {
    factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
    positionManager: "0x80C7DD17B01855a6D2347444a0FCC36136a314de",
  },
  // Base Sepolia (fallback to Uniswap for testing)
  84532: {
    factory: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    positionManager: "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
  },
  // Core DAO Mainnet - SushiSwap V3 addresses (from official documentation)
  1116: {
    factory: "0xc35dadb65012ec5796536bd9864ed8773abc74c4", // SushiSwap V3 Factory on Core DAO
    positionManager: "0xf4d73326c13a4fc5fd7a064217e12780e9bd62c3", // SushiSwap V3 Position Manager on Core DAO
  },
  // Core DAO Testnet2 - using same addresses as mainnet for testing
  1114: {
    factory: "0xc35dadb65012ec5796536bd9864ed8773abc74c4", // Same as mainnet for testing
    positionManager: "0xf4d73326c13a4fc5fd7a064217e12780e9bd62c3", // Same as mainnet for testing
  },
  // Hardhat Local
  31337: {
    factory: "0x0000000000000000000000000000000000000000", // Not deployed in local
    positionManager: "0x0000000000000000000000000000000000000000", // Not deployed in local
  },
};

export function getSushiSwapAddresses(chainId: number) {
  const addresses = SUSHISWAP_V3_ADDRESSES[chainId];
  if (!addresses) {
    return {
      factory: "0x0000000000000000000000000000000000000000",
      positionManager: "0x0000000000000000000000000000000000000000",
    };
  }
  return addresses;
}

export function isSushiSwapAvailable(chainId: number): boolean {
  const addresses = SUSHISWAP_V3_ADDRESSES[chainId];
  return (
    addresses &&
    addresses.factory !== "0x0000000000000000000000000000000000000000" &&
    addresses.positionManager !== "0x0000000000000000000000000000000000000000"
  );
}

// Backward compatibility - alias functions
export const getUniswapAddresses = getSushiSwapAddresses;
export const isUniswapAvailable = isSushiSwapAvailable;
export const UNISWAP_V3_ADDRESSES = SUSHISWAP_V3_ADDRESSES;
