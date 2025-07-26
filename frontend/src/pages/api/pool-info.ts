import { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, getContract } from 'viem';
import { sepolia } from 'viem/chains';
import { PUMPFUN_DEX_MANAGER_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';

// Create a public client for reading from the blockchain
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenAddress, ethAddress } = req.query;

  if (!tokenAddress || typeof tokenAddress !== 'string') {
    return res.status(400).json({ error: 'Token address is required' });
  }

  if (!ethAddress || typeof ethAddress !== 'string') {
    return res.status(400).json({ error: 'ETH address is required' });
  }

  try {
    const contractAddresses = getContractAddresses(sepolia.id);
    
    // Get DEX Manager contract
    const dexManagerContract = getContract({
      address: contractAddresses.PUMPFUN_DEX_MANAGER,
      abi: PUMPFUN_DEX_MANAGER_ABI,
      client: publicClient,
    });

    // Get pool info for different fee tiers
    const feesTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
    const poolsInfo = [];

    for (const fee of feesTiers) {
      try {
        const poolInfo = await dexManagerContract.read.getPoolInfo([
          tokenAddress as `0x${string}`,
          ethAddress as `0x${string}`,
          fee
        ]);

        if (poolInfo && poolInfo[3]) { // isActive is at index 3
          poolsInfo.push({
            fee,
            tokenId: poolInfo[0].toString(),
            liquidity: poolInfo[1].toString(),
            lockExpiry: poolInfo[2].toString(),
            isActive: poolInfo[3],
            createdAt: poolInfo[4].toString(),
          });
        }
      } catch (error) {
        console.log(`No pool found for fee tier ${fee}:`, error);
      }
    }

    // Get token stats
    let tokenStats = null;
    try {
      const stats = await dexManagerContract.read.getTokenStats([
        tokenAddress as `0x${string}`
      ]);
      
      tokenStats = {
        price: stats[0].toString(),
        marketCap: stats[1].toString(),
        volume24h: stats[2].toString(),
        liquidity: stats[3].toString(),
        isActive: stats[4],
      };
    } catch (error) {
      console.log('Error fetching token stats:', error);
    }

    // Check if token is authorized
    let isAuthorized = false;
    try {
      isAuthorized = await dexManagerContract.read.authorizedTokens([
        tokenAddress as `0x${string}`
      ]);
    } catch (error) {
      console.log('Error checking token authorization:', error);
    }

    const response = {
      tokenAddress,
      ethAddress,
      pools: poolsInfo,
      tokenStats,
      isAuthorized,
      hasActivePools: poolsInfo.length > 0,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching pool info:', error);
    res.status(500).json({ error: 'Failed to fetch pool information' });
  }
}
