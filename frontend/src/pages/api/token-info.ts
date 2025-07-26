import { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, getContract } from 'viem';
import { sepolia } from 'viem/chains';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from '../../lib/contracts/abis';
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

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Token address is required' });
  }

  try {
    const contractAddresses = getContractAddresses(sepolia.id);
    
    // Get token info from factory contract
    const factoryContract = getContract({
      address: contractAddresses.PUMPFUN_FACTORY,
      abi: PUMPFUN_FACTORY_ABI,
      client: publicClient,
    });

    const tokenInfo = await factoryContract.read.getTokenInfo([address as `0x${string}`]);
    
    console.log("tokenInfo:",tokenInfo)
    if (!tokenInfo) {
      return res.status(404).json({ error: 'Token not found' });
    }

    // Get token details from the token contract
    const tokenContract = getContract({
      address: address as `0x${string}`,
      abi: PUMPFUN_TOKEN_ABI,
      client: publicClient,
    });

    const [name, symbol, totalSupply] = await Promise.all([
      tokenContract.read.name(),
      tokenContract.read.symbol(),
      tokenContract.read.totalSupply(),
    ]);

    const response = {
      tokenAddress: address,
      creator: tokenInfo[0],
      deploymentTime: tokenInfo[1].toString(),
      liquidityLockPeriodDays: tokenInfo[2].toString(),
      name,
      symbol,
      totalSupply: totalSupply.toString(),
    };

    res.status(200).json(response);

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching token info:', error);
    res.status(500).json({ error: 'Failed to fetch token information' });
  }
}
