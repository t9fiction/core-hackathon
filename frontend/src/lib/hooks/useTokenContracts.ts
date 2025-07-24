import { useState } from 'react';
import { 
  useWriteContract, 
  useReadContract,
  useWaitForTransactionReceipt,
  useChainId,
  useAccount
} from 'wagmi';
import { parseEther, formatEther, Address } from 'viem';
import { 
  PUMPFUN_GOVERNANCE_ABI, 
  PUMPFUN_DEX_MANAGER_ABI,
  PUMPFUN_TOKEN_ABI,
  PUMPFUN_FACTORY_ABI
} from '../contracts/abis';
import { getContractAddresses } from '../contracts/addresses';

export const useTokenGovernance = (tokenAddress?: Address) => {
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const chainId = useChainId();
  const { address } = useAccount();
  const contractAddresses = getContractAddresses(chainId);
  
  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Read user's voting power for a token
  const { data: votingPower } = useReadContract({
    address: tokenAddress,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Read active proposals count
  const { data: proposalCount } = useReadContract({
    address: contractAddresses.PUMPFUN_GOVERNANCE,
    abi: PUMPFUN_GOVERNANCE_ABI,
    functionName: 'proposalCount',
  });

  // Get proposal details
  const getProposal = (proposalId: number) => {
    return useReadContract({
      address: contractAddresses.PUMPFUN_GOVERNANCE,
      abi: PUMPFUN_GOVERNANCE_ABI,
      functionName: 'getProposal',
      args: [BigInt(proposalId)],
    });
  };

  // Check if user has voted on a proposal  
  const hasVoted = (proposalId: number) => {
    return useReadContract({
      address: contractAddresses.PUMPFUN_GOVERNANCE,
      abi: PUMPFUN_GOVERNANCE_ABI,
      functionName: 'hasVotedOnProposal',
      args: address ? [BigInt(proposalId), address] : undefined,
    });
  };

  const createProposal = async (
    description: string,
    proposalType: number,
    proposedValue: string,
    recipients: Address[] = [],
    amounts: string[] = []
  ) => {
    if (!tokenAddress) throw new Error('Token address required');
    
    setIsCreatingProposal(true);
    try {
      const amountsBigInt = amounts.map(amount => parseEther(amount));
      
      await writeContract({
        address: contractAddresses.PUMPFUN_GOVERNANCE,
        abi: PUMPFUN_GOVERNANCE_ABI,
        functionName: 'createProposal',
        args: [
          tokenAddress,
          description,
          BigInt(proposalType),
          proposedValue ? parseEther(proposedValue) : BigInt(0),
          recipients,
          amountsBigInt,
        ],
      });
    } finally {
      setIsCreatingProposal(false);
    }
  };

  const vote = async (proposalId: number, support: boolean) => {
    setIsVoting(true);
    try {
      await writeContract({
        address: contractAddresses.PUMPFUN_GOVERNANCE,
        abi: PUMPFUN_GOVERNANCE_ABI,
        functionName: 'vote',
        args: [BigInt(proposalId), support],
      });
    } finally {
      setIsVoting(false);
    }
  };

  const executeProposal = async (proposalId: number) => {
    setIsExecuting(true);
    try {
      await writeContract({
        address: contractAddresses.PUMPFUN_GOVERNANCE,
        abi: PUMPFUN_GOVERNANCE_ABI,
        functionName: 'executeProposal',
        args: [BigInt(proposalId)],
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    // State
    isCreatingProposal,
    isVoting,
    isExecuting,
    isConfirming,
    isConfirmed,
    error,
    
    // Data
    votingPower: votingPower ? formatEther(votingPower as bigint) : '0',
    proposalCount: proposalCount ? Number(proposalCount) : 0,
    
    // Functions
    createProposal,
    vote,
    executeProposal,
    getProposal,
    hasVoted,
  };
};

export const useTokenDEX = (tokenAddress?: Address) => {
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [isCreatingPool, setIsCreatingPool] = useState(false);
  
  const chainId = useChainId();
  const { address } = useAccount();
  const contractAddresses = getContractAddresses(chainId);
  
  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Get token price and stats
  const { data: tokenStats } = useReadContract({
    address: contractAddresses.PUMPFUN_DEX_MANAGER,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: 'getTokenStats',
    args: tokenAddress ? [tokenAddress] : undefined,
  });

  // Get pool information
  const { data: poolInfo } = useReadContract({
    address: contractAddresses.PUMPFUN_DEX_MANAGER,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: 'getPoolInfo',
    args: tokenAddress ? [tokenAddress, contractAddresses.PUMPFUN_DEX_MANAGER, 3000] : undefined, // 0.3% fee tier
  });

  // Check if token is authorized
  const { data: isAuthorized } = useReadContract({
    address: contractAddresses.PUMPFUN_DEX_MANAGER,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: 'authorizedTokens',
    args: tokenAddress ? [tokenAddress] : undefined,
  });

  // Get user's token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const buyTokens = async (ethAmount: string, minTokensOut: string = '0') => {
    if (!tokenAddress) throw new Error('Token address required');
    
    setIsBuying(true);
    try {
      await writeContract({
        address: contractAddresses.PUMPFUN_DEX_MANAGER,
        abi: PUMPFUN_DEX_MANAGER_ABI,
        functionName: 'swapExactETHForTokens',
        args: [
          tokenAddress,
          3000, // 0.3% fee tier
          parseEther(minTokensOut),
        ],
        value: parseEther(ethAmount),
      });
    } finally {
      setIsBuying(false);
    }
  };

  const sellTokens = async (tokenAmount: string, minEthOut: string = '0') => {
    if (!tokenAddress) throw new Error('Token address required');
    
    setIsSelling(true);
    try {
      await writeContract({
        address: contractAddresses.PUMPFUN_DEX_MANAGER,
        abi: PUMPFUN_DEX_MANAGER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [
          tokenAddress,
          3000, // 0.3% fee tier
          parseEther(tokenAmount),
          parseEther(minEthOut),
        ],
      });
    } finally {
      setIsSelling(false);
    }
  };

  const addLiquidity = async (tokenAmount: string, ethAmount: string) => {
    if (!tokenAddress) throw new Error('Token address required');
    
    setIsAddingLiquidity(true);
    try {
      await writeContract({
        address: contractAddresses.PUMPFUN_DEX_MANAGER,
        abi: PUMPFUN_DEX_MANAGER_ABI,
        functionName: 'addLiquidity',
        args: [
          tokenAddress,
          contractAddresses.PUMPFUN_DEX_MANAGER, // WETH address should be fetched from DEX manager
          3000, // 0.3% fee tier
          parseEther(tokenAmount),
          parseEther(ethAmount),
        ],
        value: parseEther(ethAmount),
      });
    } finally {
      setIsAddingLiquidity(false);
    }
  };

  const createDEXPool = async (tokenAmount: string, ethAmount: string, fee: number = 3000) => {
    if (!tokenAddress) throw new Error('Token address required');
    
    setIsCreatingPool(true);
    try {
      await writeContract({
        address: contractAddresses.PUMPFUN_FACTORY,
        abi: PUMPFUN_FACTORY_ABI,
        functionName: 'createDEXPool',
        args: [
          tokenAddress,
          parseEther(tokenAmount),
          fee, // Fee tier (3000 = 0.3%)
        ],
        value: parseEther(ethAmount),
      });
    } finally {
      setIsCreatingPool(false);
    }
  };

  const formatTokenStats = (stats: any) => {
    if (!stats) return null;
    
    return {
      price: formatEther(stats[0] || BigInt(0)),
      marketCap: formatEther(stats[1] || BigInt(0)),
      volume24h: formatEther(stats[2] || BigInt(0)),
      liquidity: formatEther(stats[3] || BigInt(0)),
      isActive: stats[4] || false,
    };
  };

  return {
    // State
    isBuying,
    isSelling,
    isAddingLiquidity,
    isCreatingPool,
    isConfirming,
    isConfirmed,
    error,
    
    // Data
    tokenStats: formatTokenStats(tokenStats),
    poolInfo,
    isAuthorized: Boolean(isAuthorized),
    tokenBalance: tokenBalance ? formatEther(tokenBalance as bigint) : '0',
    
    // Functions
    buyTokens,
    sellTokens,
    addLiquidity,
    createDEXPool,
  };
};

export const useTokenLock = (tokenAddress?: Address) => {
  const [isLocking, setIsLocking] = useState(false);
  
  const chainId = useChainId();
  const { address } = useAccount();
  const contractAddresses = getContractAddresses(chainId);
  
  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Get liquidity lock information
  const { data: liquidityInfo } = useReadContract({
    address: contractAddresses.PUMPFUN_FACTORY,
    abi: PUMPFUN_FACTORY_ABI, 
    functionName: 'liquidityInfo',
    args: tokenAddress ? [tokenAddress] : undefined,
  });

  const lockTokens = async (ethAmount: string, tokenAmount: string, duration: number) => {
    if (!tokenAddress) throw new Error('Token address required');
    
    setIsLocking(true);
    try {
      // This would call a lock function on the factory or a separate locking contract
      writeContract({
        address: contractAddresses.PUMPFUN_FACTORY,
        abi: PUMPFUN_FACTORY_ABI,
        functionName: 'addAndLockLiquidity', // Update with correct function name
        args: [
          tokenAddress,
          parseEther(tokenAmount),
        ],
        value: parseEther(ethAmount),
      });
    } finally {
      setIsLocking(false);
    }
  };

  return {
    // State
    isLocking,
    isConfirming,
    isConfirmed,
    error,
    
    // Data
    liquidityInfo,
    
    // Functions
    lockTokens,
  };
};
