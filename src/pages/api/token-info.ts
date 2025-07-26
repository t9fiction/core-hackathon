import { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, getContract } from 'viem';
import { sepolia, mainnet, hardhat } from 'viem/chains';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';

// Function to get the appropriate chain
function getChain(chainId: number) {
  switch (chainId) {
    case 1:
      return mainnet;
    case 11155111:
      return sepolia;
    case 31337:
      return hardhat;
    default:
      return sepolia; // default fallback
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, addresses, chainId } = req.query;
  
  // Handle both single address and multiple addresses
  let tokenAddresses: string[];
  
  if (addresses && typeof addresses === 'string') {
    // Multiple addresses separated by comma
    tokenAddresses = addresses.split(',').filter(addr => addr.trim().length > 0);
  } else if (address && typeof address === 'string') {
    // Single address
    tokenAddresses = [address];
  } else {
    return res.status(400).json({ error: 'Token address(es) required' });
  }

  try {
    // Use provided chainId or default to sepolia
    const targetChainId = chainId ? parseInt(chainId as string) : sepolia.id;
    const contractAddresses = getContractAddresses(targetChainId);
    
    // Create a public client for the specific chain
    const publicClient = createPublicClient({
      chain: getChain(targetChainId),
      transport: http(),
    });
    
    // Get token info from factory contract
    const factoryContract = getContract({
      address: contractAddresses.PUMPFUN_FACTORY,
      abi: PUMPFUN_FACTORY_ABI,
      client: publicClient,
    });

    // Process multiple addresses
    const tokensData = [];
    
    for (const tokenAddr of tokenAddresses) {
      try {
        const tokenInfo = await factoryContract.read.getTokenInfo([tokenAddr as `0x${string}`]);
        
        console.log(`tokenInfo for ${tokenAddr}:`, tokenInfo);
        if (!tokenInfo) {
          console.log(`Token not found: ${tokenAddr}`);
          continue;
        }

        // Get token details from the token contract
        const tokenContract = getContract({
          address: tokenAddr as `0x${string}`,
          abi: PUMPFUN_TOKEN_ABI,
          client: publicClient,
        });

        const [name, symbol, totalSupply] = await Promise.all([
          tokenContract.read.name(),
          tokenContract.read.symbol(),
          tokenContract.read.totalSupply(),
        ]);

        tokensData.push({
          address: tokenAddr,
          creator: tokenInfo[0],
          deploymentTime: tokenInfo[1].toString(),
          liquidityLockPeriodDays: tokenInfo[2].toString(),
          name,
          symbol,
          totalSupply: totalSupply.toString(),
        });
      } catch (error) {
        console.error(`Error fetching info for token ${tokenAddr}:`, error);
        // Continue with other tokens even if one fails
      }
    }

    const response = {
      success: true,
      tokens: tokensData,
      count: tokensData.length
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching token info:', error);
    res.status(500).json({ error: 'Failed to fetch token information' });
  }
}
