import { createWalletClient, http, publicActions, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { coreTestnet2, coreDao } from 'wagmi/chains';

// Fallback wallet private key from environment variable
const FALLBACK_PRIVATE_KEY = process.env.NEXT_PUBLIC_FALLBACK_WALLET_PRIVATE_KEY
  ? `0x${process.env.NEXT_PUBLIC_FALLBACK_WALLET_PRIVATE_KEY}` as const
  : null;

if (!FALLBACK_PRIVATE_KEY) {
  console.warn('NEXT_PUBLIC_FALLBACK_WALLET_PRIVATE_KEY not set in environment variables. Fallback wallet functionality will be disabled.');
}

// Create account from private key (only if key is available)
const fallbackAccount = FALLBACK_PRIVATE_KEY ? privateKeyToAccount(FALLBACK_PRIVATE_KEY) : null;

// Get RPC URLs for the chains
const getRpcUrl = (chainId: number) => {
  switch (chainId) {
    case coreTestnet2.id:
      return coreTestnet2.rpcUrls.default.http[0];
    case coreDao.id:
      return coreDao.rpcUrls.default.http[0];
    default:
      return coreTestnet2.rpcUrls.default.http[0]; // Default to testnet
  }
};

// Create fallback wallet clients for different chains
export const createFallbackWalletClient = (chainId: number) => {
  if (!fallbackAccount) {
    throw new Error('Fallback wallet account not available. Please check NEXT_PUBLIC_FALLBACK_WALLET_PRIVATE_KEY environment variable.');
  }
  
  const chain = chainId === coreDao.id ? coreDao : coreTestnet2;
  const rpcUrl = getRpcUrl(chainId);
  
  return createWalletClient({
    account: fallbackAccount,
    chain,
    transport: http(rpcUrl),
  }).extend(publicActions);
};

// Create fallback public client
export const createFallbackPublicClient = (chainId: number) => {
  const chain = chainId === coreDao.id ? coreDao : coreTestnet2;
  const rpcUrl = getRpcUrl(chainId);
  
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
};

// Fallback wallet info for display
export const fallbackWalletInfo = fallbackAccount ? {
  address: fallbackAccount.address,
  name: 'System Wallet',
  isConnected: true,
  isFallback: true,
} as const : null;

export { fallbackAccount };
