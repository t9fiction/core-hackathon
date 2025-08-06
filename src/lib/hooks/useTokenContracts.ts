import { useState, useEffect } from "react";
import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useChainId,
  useAccount,
} from "wagmi";
import {
  UNISWAP_V3_FACTORY_ABI,
  UNISWAP_V3_POOL_ABI,
  NONFUNGIBLE_POSITION_MANAGER_ABI,
  PUMPFUN_GOVERNANCE_ABI,
  PUMPFUN_DEX_MANAGER_ABI,
  PUMPFUN_TOKEN_ABI,
  PUMPFUN_FACTORY_ABI,
} from "../contracts/abis";
import { parseEther, formatEther, Address, parseUnits } from "viem";
import { getContractAddresses } from "../contracts/addresses";

interface PoolInfo {
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  liquidity: string;
  sqrtPriceX96: string;
  tick: number;
}

interface PositionInfo {
  tokenId: number;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  tokensOwed0: string;
  tokensOwed1: string;
}

export const useTokenGovernance = (tokenAddress?: Address) => {
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const chainId = useChainId();
  const { address } = useAccount();
  const contractAddresses = getContractAddresses(chainId);

  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Read user's voting power for a token
  const { data: votingPower } = useReadContract({
    address: tokenAddress,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read active proposals count
  const { data: proposalCount } = useReadContract({
    address: contractAddresses.PUMPFUN_GOVERNANCE,
    abi: PUMPFUN_GOVERNANCE_ABI,
    functionName: "proposalCount",
  });

  // Reset isCreatingProposal when transaction is confirmed or failed
  useEffect(() => {
    if (isConfirmed || error) {
      setIsCreatingProposal(false);
    }
  }, [isConfirmed, error]);

  // These hooks need to be created in the component that uses them
  // We'll provide helper functions to create the hook configurations
  const getProposalConfig = (proposalId: number) => ({
    address: contractAddresses.PUMPFUN_GOVERNANCE,
    abi: PUMPFUN_GOVERNANCE_ABI,
    functionName: "getProposal" as const,
    args: [BigInt(proposalId)],
  });

  const hasVotedConfig = (proposalId: number) => ({
    address: contractAddresses.PUMPFUN_GOVERNANCE,
    abi: PUMPFUN_GOVERNANCE_ABI,
    functionName: "hasVotedOnProposal" as const,
    args: address ? [BigInt(proposalId), address] : undefined,
  });

  const createProposal = async (
    description: string,
    proposalType: number,
    proposedValue: string,
    recipients: Address[] = [],
    amounts: string[] = []
  ) => {
    if (!tokenAddress) throw new Error("Token address required");

    setIsCreatingProposal(true);
    try {
      const amountsBigInt = amounts.map((amount) => parseEther(amount));

      const txHash = await writeContract({
        address: contractAddresses.PUMPFUN_GOVERNANCE,
        abi: PUMPFUN_GOVERNANCE_ABI,
        functionName: "createProposal",
        args: [
          tokenAddress,
          description,
          BigInt(proposalType),
          proposedValue ? parseEther(proposedValue) : BigInt(0),
          recipients,
          amountsBigInt,
        ],
      });
      
      return txHash;
    } catch (error) {
      setIsCreatingProposal(false);
      throw error;
    }
  };

  const vote = async (proposalId: number, support: boolean) => {
    setIsVoting(true);
    try {
      await writeContract({
        address: contractAddresses.PUMPFUN_GOVERNANCE,
        abi: PUMPFUN_GOVERNANCE_ABI,
        functionName: "vote",
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
        functionName: "executeProposal",
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
    votingPower: votingPower ? formatEther(votingPower as bigint) : "0",
    proposalCount: proposalCount ? Number(proposalCount) : 0,

    // Functions
    createProposal,
    vote,
    executeProposal,
    getProposalConfig,
    hasVotedConfig,
  };
};

export const useTokenDEX = (tokenAddress: Address) => {
  const { address: userAddress } = useAccount();
  const chainId = 11155111; // Sepolia Testnet
  const contractAddresses = getContractAddresses(chainId);
  const [isCreatingPool, setIsCreatingPool] = useState(false);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [positionInfo, setPositionInfo] = useState<PositionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [poolExists, setPoolExists] = useState(false);

  const { writeContractAsync } = useWriteContract();

  const WETH_ADDRESS = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";
  const UNISWAP_V3_FACTORY_ADDRESS =
    "0x0227628f3F023bb0B980b67D528571c95c6DaC1c";
  const NONFUNGIBLE_POSITION_MANAGER_ADDRESS =
    "0x1238536071E1c677A632429e3655c799b22cDA52";

  // Read pool info from DEX Manager
  const { data: poolInfoData, refetch: refetchPoolInfo } = useReadContract({
    address: contractAddresses.PUMPFUN_DEX_MANAGER,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: "getPoolInfo",
    args: [tokenAddress, WETH_ADDRESS, 3000], // Default 0.3% fee
  });

  // Read token stats from DEX Manager
  const { data: tokenStats, refetch: refetchTokenStats } = useReadContract({
    address: contractAddresses.PUMPFUN_DEX_MANAGER,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: "getTokenStats",
    args: [tokenAddress],
  });

  // Check if token is authorized
  const { data: isAuthorized } = useReadContract({
    address: contractAddresses.PUMPFUN_DEX_MANAGER,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: "authorizedTokens",
    args: [tokenAddress],
  });

  // Update pool info when data changes
  useEffect(() => {
    if (poolInfoData && Array.isArray(poolInfoData) && poolInfoData.length >= 5) {
      const [tokenId, liquidity, lockExpiry, isActive, createdAt] = poolInfoData as [bigint, bigint, bigint, boolean, bigint];
      setPoolExists(isActive);
      if (isActive) {
        setPoolInfo({
          poolAddress: "" + tokenId, // We'll get the actual pool address separately
          token0: tokenAddress < WETH_ADDRESS ? tokenAddress : WETH_ADDRESS,
          token1: tokenAddress < WETH_ADDRESS ? WETH_ADDRESS : tokenAddress,
          fee: 3000,
          liquidity: liquidity.toString(),
          sqrtPriceX96: "0", // We'll update this if needed
          tick: 0,
        });
      }
    }
  }, [poolInfoData, tokenAddress]);

  const createFactoryDEXPool = async (
    tokenAmount: string,
    ethAmount: string,
    fee: number = 3000
  ) => {
    setIsCreatingPool(true);
    setError(null);
    try {
      const tokenAmountWei = parseUnits(tokenAmount, 18);
      const ethAmountWei = parseEther(ethAmount);

      // First approve the factory to spend tokens
      await writeContractAsync({
        address: tokenAddress,
        abi: PUMPFUN_TOKEN_ABI,
        functionName: "approve",
        args: [contractAddresses.PUMPFUN_FACTORY, tokenAmountWei],
      });

      // Create pool via factory
      const tx = await writeContractAsync({
        address: contractAddresses.PUMPFUN_FACTORY,
        abi: PUMPFUN_FACTORY_ABI,
        functionName: "createDEXPool",
        args: [tokenAddress, tokenAmountWei, fee],
        value: ethAmountWei,
      });

      // Refetch pool info after creation
      setTimeout(() => {
        refetchPoolInfo();
        refetchTokenStats();
      }, 2000);

      return tx;
    } catch (error: any) {
      setError(error.message || "Failed to create DEX pool via factory");
      throw error;
    } finally {
      setIsCreatingPool(false);
    }
  };

  const createDEXPool = async (
    tokenAmount: string,
    ethAmount: string,
    fee: number
  ) => {
    setIsCreatingPool(true);
    setError(null);
    try {
      const token0 = tokenAddress < WETH_ADDRESS ? tokenAddress : WETH_ADDRESS;
      const token1 = tokenAddress < WETH_ADDRESS ? WETH_ADDRESS : tokenAddress;
      const isToken0 = tokenAddress === token0;

      // Approve tokens
      const tokenAmountWei = parseUnits(tokenAmount, 18); // Assuming 18 decimals for token
      const ethAmountWei = parseEther(ethAmount);

      await writeContractAsync({
        address: tokenAddress,
        abi: PUMPFUN_TOKEN_ABI, // Use ERC20 ABI for approval
        functionName: "approve",
        args: [NONFUNGIBLE_POSITION_MANAGER_ADDRESS, tokenAmountWei],
      });

      await writeContractAsync({
        address: WETH_ADDRESS,
        abi: PUMPFUN_TOKEN_ABI, // Use ERC20 ABI for WETH approval
        functionName: "approve",
        args: [NONFUNGIBLE_POSITION_MANAGER_ADDRESS, ethAmountWei],
      });

      // For now, we'll skip the pool existence check and assume pool creation is handled elsewhere
      // In a production app, you'd want to use a different approach like storing pool data in state
      // or using a separate service to check pool existence
      
      // Create pool without checking if it exists first
      await writeContractAsync({
        address: UNISWAP_V3_FACTORY_ADDRESS,
        abi: UNISWAP_V3_FACTORY_ABI,
        functionName: "createPool",
        args: [token0, token1, fee],
      });

      // Use default tick values for now (this would need to be improved in production)
      const defaultTick = 0;
      const tickSpacing = fee === 500 ? 10 : fee === 3000 ? 60 : 200;
      const tickLower =
        Math.floor((defaultTick - 600) / tickSpacing) * tickSpacing;
      const tickUpper =
        Math.ceil((defaultTick + 600) / tickSpacing) * tickSpacing;

      // Mint liquidity position
      const mintParams = {
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        amount0Desired: isToken0 ? tokenAmountWei : ethAmountWei,
        amount1Desired: isToken0 ? ethAmountWei : tokenAmountWei,
        amount0Min: 0,
        amount1Min: 0,
        recipient: userAddress,
        deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
      };

      const tx = await writeContractAsync({
        address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "mint",
        args: [mintParams],
        value: isToken0 ? ethAmountWei : BigInt(0), // Send ETH if WETH is token1
      });

      return tx;
    } catch (error: any) {
      setError(error.message || "Failed to create DEX pool");
      throw error;
    } finally {
      setIsCreatingPool(false);
    }
  };

  const addLiquidity = async (
    tokenAmount: string,
    ethAmount: string,
    fee: number
  ) => {
    setError(null);
    try {
      const token0 = tokenAddress < WETH_ADDRESS ? tokenAddress : WETH_ADDRESS;
      const token1 = tokenAddress < WETH_ADDRESS ? WETH_ADDRESS : tokenAddress;
      const isToken0 = tokenAddress === token0;

      const tokenAmountWei = parseUnits(tokenAmount, 18);
      const ethAmountWei = parseEther(ethAmount);

      // Approve tokens
      await writeContractAsync({
        address: tokenAddress,
        abi: PUMPFUN_TOKEN_ABI,
        functionName: "approve",
        args: [NONFUNGIBLE_POSITION_MANAGER_ADDRESS, tokenAmountWei],
      });

      await writeContractAsync({
        address: WETH_ADDRESS,
        abi: PUMPFUN_TOKEN_ABI,
        functionName: "approve",
        args: [NONFUNGIBLE_POSITION_MANAGER_ADDRESS, ethAmountWei],
      });

      // For now, assume pool exists and use default tick range
      // In production, you'd want to handle pool existence checking differently
      const defaultTick = 0;
      const tickSpacing = fee === 500 ? 10 : fee === 3000 ? 60 : 200;
      const tickLower =
        Math.floor((defaultTick - 600) / tickSpacing) * tickSpacing;
      const tickUpper =
        Math.ceil((defaultTick + 600) / tickSpacing) * tickSpacing;

      // Mint liquidity
      const mintParams = {
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        amount0Desired: isToken0 ? tokenAmountWei : ethAmountWei,
        amount1Desired: isToken0 ? ethAmountWei : tokenAmountWei,
        amount0Min: 0,
        amount1Min: 0,
        recipient: userAddress,
        deadline: Math.floor(Date.now() / 1000) + 1800,
      };

      const tx = await writeContractAsync({
        address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "mint",
        args: [mintParams],
        value: isToken0 ? ethAmountWei : BigInt(0),
      });

      return tx;
    } catch (error: any) {
      setError(error.message || "Failed to add liquidity");
      throw error;
    }
  };

  return {
    createDEXPool,
    createFactoryDEXPool,
    addLiquidity,
    isCreatingPool,
    poolInfo,
    positionInfo,
    error,
    poolExists,
    tokenStats,
    isAuthorized,
    refetchPoolInfo,
    refetchTokenStats,
    setPoolInfo,
    setPositionInfo,
  };
};

export const useTokenLock = (tokenAddress?: Address) => {
  const [isLocking, setIsLocking] = useState(false);

  const chainId = useChainId();
  const { address } = useAccount();
  const contractAddresses = getContractAddresses(chainId);

  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Note: The factory contract doesn't have a liquidityInfo function
  // This would need to be implemented if liquidity lock tracking is needed

  const lockTokens = async (
    ethAmount: string,
    tokenAmount: string,
    duration: number
  ) => {
    if (!tokenAddress) throw new Error("Token address required");

    setIsLocking(true);
    try {
      // TODO: Implement liquidity locking functionality
      // The factory contract doesn't currently have a locking function
      // This would need to be implemented in the smart contract first
      console.warn("Liquidity locking not yet implemented in smart contract");
      throw new Error("Liquidity locking functionality not yet available");
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
    // liquidityInfo would be available if implemented in the contract

    // Functions
    lockTokens,
  };
};
