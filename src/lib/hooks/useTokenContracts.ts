import { useState, useEffect } from "react";
import {
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useChainId,
  useAccount,
} from "wagmi";
import {
  CHAINCRAFT_GOVERNANCE_ABI,
  CHAINCRAFT_DEX_MANAGER_ABI,
  CHAINCRAFT_TOKEN_ABI,
  CHAINCRAFT_FACTORY_ABI,
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
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read active proposals count
  const { data: proposalCount } = useReadContract({
    address: contractAddresses.CHAINCRAFT_GOVERNANCE,
    abi: CHAINCRAFT_GOVERNANCE_ABI,
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
    address: contractAddresses.CHAINCRAFT_GOVERNANCE,
    abi: CHAINCRAFT_GOVERNANCE_ABI,
    functionName: "getProposal" as const,
    args: [BigInt(proposalId)],
  });

  const hasVotedConfig = (proposalId: number) => ({
    address: contractAddresses.CHAINCRAFT_GOVERNANCE,
    abi: CHAINCRAFT_GOVERNANCE_ABI,
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
        address: contractAddresses.CHAINCRAFT_GOVERNANCE,
        abi: CHAINCRAFT_GOVERNANCE_ABI,
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
        address: contractAddresses.CHAINCRAFT_GOVERNANCE,
        abi: CHAINCRAFT_GOVERNANCE_ABI,
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
        address: contractAddresses.CHAINCRAFT_GOVERNANCE,
        abi: CHAINCRAFT_GOVERNANCE_ABI,
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
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  // Check if token is authorized in the DEX Manager
  const { data: isAuthorized, refetch: refetchAuthorization } = useReadContract({
    address: contractAddresses.CHAINCRAFT_DEX_MANAGER,
    abi: CHAINCRAFT_DEX_MANAGER_ABI,
    functionName: "authorizedTokens",
    args: [tokenAddress],
  });

  const authorizeTokenForTrading = async () => {
    setIsAuthorizing(true);
    setError(null);
    try {
      console.log('Authorizing token for DEX trading...', { tokenAddress });

      // Authorize token for DEX trading via factory
      await writeContractAsync({
        address: contractAddresses.CHAINCRAFT_FACTORY,
        abi: CHAINCRAFT_FACTORY_ABI,
        functionName: "authorizeDEXTrading",
        args: [tokenAddress],
      });
      
      console.log('Token authorized for DEX trading successfully');
      
      // Refetch authorization status
      await refetchAuthorization();
      
      return true;
    } catch (error: any) {
      console.error('Error authorizing token:', error);
      setError(error.message || "Failed to authorize token");
      throw error;
    } finally {
      setIsAuthorizing(false);
    }
  };

  return {
    // Authorization functions
    authorizeTokenForTrading,
    
    // State
    isAuthorizing,
    error,
    isAuthorized: isAuthorized as boolean,
    
    // Utilities
    refetchAuthorization,
  };
};

export const useTokenLock = (tokenAddress?: Address) => {
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const chainId = useChainId();
  const { address } = useAccount();
  const contractAddresses = getContractAddresses(chainId);

  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Get token lock information from factory contract
  const { data: tokenLockData, refetch: refetchTokenLock } = useReadContract({
    address: contractAddresses.CHAINCRAFT_FACTORY,
    abi: CHAINCRAFT_FACTORY_ABI,
    functionName: "getTokenLock",
    args: tokenAddress ? [tokenAddress] : undefined,
  });

  // Check if token is currently locked
  const { data: isTokenLocked, refetch: refetchLockStatus } = useReadContract({
    address: contractAddresses.CHAINCRAFT_FACTORY,
    abi: CHAINCRAFT_FACTORY_ABI,
    functionName: "isTokenCurrentlyLocked",
    args: tokenAddress ? [tokenAddress] : undefined,
  });

  // Get days until unlock
  const { data: daysUntilUnlock, refetch: refetchDaysUntilUnlock } = useReadContract({
    address: contractAddresses.CHAINCRAFT_FACTORY,
    abi: CHAINCRAFT_FACTORY_ABI,
    functionName: "getDaysUntilUnlock",
    args: tokenAddress ? [tokenAddress] : undefined,
  });

  // Reset loading states when transaction is confirmed or failed
  useEffect(() => {
    if (isConfirmed || error) {
      setIsLocking(false);
      setIsUnlocking(false);
      // Refetch data after successful transaction
      if (isConfirmed) {
        refetchTokenLock();
        refetchLockStatus();
        refetchDaysUntilUnlock();
      }
    }
  }, [isConfirmed, error, refetchTokenLock, refetchLockStatus, refetchDaysUntilUnlock]);

  const lockTokens = async (
    tokenAmount: string,
    ethAmount: string,
    duration: number,
    description: string = "Token lock for community trust"
  ) => {
    if (!tokenAddress) throw new Error("Token address required");
    if (!address) throw new Error("Wallet not connected");

    setIsLocking(true);
    try {
      const tokenAmountWei = parseEther(tokenAmount);
      const ethAmountWei = parseEther(ethAmount);
      const durationInSeconds = duration * 24 * 60 * 60; // Convert days to seconds

      // First approve tokens to the factory contract
      await writeContract({
        address: tokenAddress,
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: "approve",
        args: [contractAddresses.CHAINCRAFT_FACTORY, tokenAmountWei],
      });

      // Wait a bit for approval transaction
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Lock the tokens using factory contract
      await writeContract({
        address: contractAddresses.CHAINCRAFT_FACTORY,
        abi: CHAINCRAFT_FACTORY_ABI,
        functionName: "lockTokens",
        args: [tokenAddress, tokenAmountWei, BigInt(durationInSeconds), description],
        value: ethAmountWei,
      });

    } catch (error) {
      setIsLocking(false);
      throw error;
    }
  };

  const unlockTokens = async () => {
    if (!tokenAddress) throw new Error("Token address required");
    if (!address) throw new Error("Wallet not connected");

    setIsUnlocking(true);
    try {
      await writeContract({
        address: contractAddresses.CHAINCRAFT_FACTORY,
        abi: CHAINCRAFT_FACTORY_ABI,
        functionName: "unlockTokens",
        args: [tokenAddress],
      });
    } catch (error) {
      setIsUnlocking(false);
      throw error;
    }
  };

  return {
    // State
    isLocking,
    isUnlocking,
    isConfirming,
    isConfirmed,
    error,

    // Data
    tokenLockData,
    isTokenLocked: isTokenLocked as boolean,
    daysUntilUnlock: daysUntilUnlock ? Number(daysUntilUnlock) : 0,
    activeLocks: tokenLockData && (tokenLockData as any).isActive ? [tokenLockData] : [],
    totalLocked: tokenLockData ? formatEther((tokenLockData as any).tokenAmount || BigInt(0)) : "0",
    totalETHLocked: tokenLockData ? formatEther((tokenLockData as any).ethAmount || BigInt(0)) : "0",
    userLockIds: tokenLockData && (tokenLockData as any).isActive && 
                 (tokenLockData as any).owner === address ? ["current"] : [],

    // Functions
    lockTokens,
    unlockTokens,
    refetchTokenLock,
    refetchLockStatus,
    refetchDaysUntilUnlock,
  };
};
