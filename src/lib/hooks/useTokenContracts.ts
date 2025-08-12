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
  CHAINCRAFT_GOVERNANCE_ABI,
  CHAINCRAFT_DEX_MANAGER_ABI,
  CHAINCRAFT_TOKEN_ABI,
  CHAINCRAFT_FACTORY_ABI,
} from "../contracts/abis";
import { parseEther, formatEther, Address, parseUnits } from "viem";
import { getContractAddresses } from "../contracts/addresses";
import { getSushiSwapAddresses, isSushiSwapAvailable } from "../contracts/uniswap-addresses";

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
  const { address: userAddress } = useAccount();
  const chainId = useChainId(); // Dynamic chain detection
  const contractAddresses = getContractAddresses(chainId);
  const [isCreatingPool, setIsCreatingPool] = useState(false);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [positionInfo, setPositionInfo] = useState<PositionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [poolExists, setPoolExists] = useState(false);

  const { writeContractAsync } = useWriteContract();

  // Use dynamic WETH address based on current chain
  const WETH_ADDRESS = contractAddresses.WETH;
  // Get SushiSwap V3 addresses
  const sushiAddresses = getSushiSwapAddresses(chainId);
  const UNISWAP_V3_FACTORY_ADDRESS = sushiAddresses.factory;
  const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = sushiAddresses.positionManager;

  // Note: getPoolInfo and getTokenStats functions don't exist in the current DEX Manager ABI
  // We'll rely on external pool checking methods or implement pool existence detection differently
  const poolInfoData = null;
  const tokenStats = null;
  
  const refetchPoolInfo = () => {
    console.log('Pool info refetch - not implemented yet');
  };
  
  const refetchTokenStats = () => {
    console.log('Token stats refetch - not implemented yet');
  };

  // Check if token is authorized
  const { data: isAuthorized } = useReadContract({
    address: contractAddresses.CHAINCRAFT_DEX_MANAGER,
    abi: CHAINCRAFT_DEX_MANAGER_ABI,
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

      console.log('Creating pool via factory with params:', {
        tokenAddress,
        tokenAmount: tokenAmountWei.toString(),
        ethAmount: ethAmountWei.toString(),
        fee
      });

      // Step 1: Authorize token for DEX trading via factory
      console.log('Step 1: Authorizing token for DEX trading...');
      await writeContractAsync({
        address: contractAddresses.CHAINCRAFT_FACTORY,
        abi: CHAINCRAFT_FACTORY_ABI,
        functionName: "authorizeDEXTrading",
        args: [tokenAddress],
      });
      
      console.log('Token authorized for DEX trading');

      // Step 2: Authorize the token in the DEX Manager as well
      console.log('Step 2: Authorizing token in DEX Manager...');
      await writeContractAsync({
        address: contractAddresses.CHAINCRAFT_DEX_MANAGER,
        abi: CHAINCRAFT_DEX_MANAGER_ABI,
        functionName: "authorizeToken",
        args: [tokenAddress],
      });
      
      console.log('Token authorized in DEX Manager');
      
      // Step 3: Create a SushiSwap V3 pool directly since factory doesn't have createDEXPool
      console.log('Step 3: Creating SushiSwap V3 pool directly...');
      
      // Use the createDEXPool method which handles Uniswap V3 creation
      const tx = await createDEXPool(tokenAmount, ethAmount, fee);

      console.log('Pool creation completed successfully');
      setPoolExists(true);
      
      // Refetch pool info after creation
      setTimeout(() => {
        refetchPoolInfo();
        refetchTokenStats();
      }, 2000);

      return tx;
    } catch (error: any) {
      console.error('Error in createFactoryDEXPool:', error);
      setError(error.message || "Failed to create DEX pool");
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
    if (!UNISWAP_V3_FACTORY_ADDRESS || UNISWAP_V3_FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000") {
      throw new Error(`SushiSwap V3 not available on chain ${chainId}`);
    }
    
    if (!NONFUNGIBLE_POSITION_MANAGER_ADDRESS || NONFUNGIBLE_POSITION_MANAGER_ADDRESS === "0x0000000000000000000000000000000000000000") {
      throw new Error(`SushiSwap V3 Position Manager not available on chain ${chainId}`);
    }
    
    setIsCreatingPool(true);
    setError(null);
    try {
      console.log('Creating SushiSwap V3 pool with parameters:', {
        tokenAddress,
        tokenAmount,
        ethAmount,
        fee,
        chainId,
        factoryAddress: UNISWAP_V3_FACTORY_ADDRESS,
        positionManagerAddress: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        wcoreAddress: WETH_ADDRESS,
        network: 'Core DAO Mainnet',
        dex: 'SushiSwap V3'
      });
      
      const token0 = tokenAddress < WETH_ADDRESS ? tokenAddress : WETH_ADDRESS;
      const token1 = tokenAddress < WETH_ADDRESS ? WETH_ADDRESS : tokenAddress;
      const isToken0 = tokenAddress === token0;

      const tokenAmountWei = parseUnits(tokenAmount, 18);
      const ethAmountWei = parseEther(ethAmount);
      
      console.log('Token ordering for SushiSwap V3 on Core DAO:', { 
        token0, 
        token1, 
        isToken0, 
        tokenAmountWei: tokenAmountWei.toString(), 
        coreAmountWei: ethAmountWei.toString(),
        yourTokenAddress: tokenAddress,
        wcoreAddress: WETH_ADDRESS
      });

      // Step 1: Approve token to position manager
      console.log('Step 1: Approving token to position manager...');
      await writeContractAsync({
        address: tokenAddress,
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: "approve",
        args: [NONFUNGIBLE_POSITION_MANAGER_ADDRESS as Address, tokenAmountWei],
      });
      console.log('Token approved successfully');

      // Step 1.5: For Core DAO, the Position Manager will automatically wrap CORE to WCORE
      // We don't need to manually approve WCORE since we're sending native CORE
      console.log('Step 1.5: Native CORE will be automatically wrapped to WCORE by SushiSwap Position Manager');

      // Step 2: Try to create pool (might fail if already exists, which is ok)
      console.log('Step 2: Creating pool...');
      let poolExists = false;
      try {
        await writeContractAsync({
          address: UNISWAP_V3_FACTORY_ADDRESS as Address,
          abi: UNISWAP_V3_FACTORY_ABI,
          functionName: "createPool",
          args: [token0, token1, fee],
        });
        console.log('Pool created successfully');
        poolExists = true;
      } catch (poolError: any) {
        console.log('Pool creation failed:', poolError.message);
        if (poolError.message.includes('already exists') || 
            poolError.message.includes('PoolAlreadyExists') ||
            poolError.message.includes('pool already exists') ||
            poolError.message.includes('Pool already exists')) {
          console.log('Pool already exists, continuing...');
          poolExists = true;
        } else {
          console.error('Unexpected pool creation error:', poolError);
          throw new Error(`Failed to create pool: ${poolError.message}`);
        }
      }

      if (!poolExists) {
        throw new Error('Pool creation failed and pool does not exist');
      }

      // Step 3: Calculate proper tick range for the fee tier
      console.log('Step 3: Calculating tick range...');
      const tickSpacing = fee === 500 ? 10 : fee === 3000 ? 60 : 200;
      
      // Use a reasonable range instead of full range to avoid issues
      // Full range can cause problems, use a large but valid range
      const minTick = -887272; // Actual min tick for most pools
      const maxTick = 887272;   // Actual max tick for most pools
      
      const tickLower = Math.floor(minTick / tickSpacing) * tickSpacing;
      const tickUpper = Math.floor(maxTick / tickSpacing) * tickSpacing;
      
      console.log('Tick range calculated:', { tickLower, tickUpper, tickSpacing, minTick, maxTick });

      // Step 4: Prepare mint parameters with proper amounts
      console.log('Step 4: Preparing mint parameters...');
      
      // Both tokens need amounts for liquidity provision
      const amount0Desired = isToken0 ? tokenAmountWei : ethAmountWei;
      const amount1Desired = isToken0 ? ethAmountWei : tokenAmountWei;
      
      const mintParams = {
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min: 0n, // Accept any amount of token0 (for slippage)
        amount1Min: 0n, // Accept any amount of token1 (for slippage)
        recipient: userAddress as Address,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1800), // 30 minutes from now
      };
      
      console.log('SushiSwap V3 Mint parameters for Core DAO:', {
        ...mintParams,
        amount0Desired: mintParams.amount0Desired.toString(),
        amount1Desired: mintParams.amount1Desired.toString(),
        deadline: mintParams.deadline.toString(),
        token0Symbol: isToken0 ? 'YOUR_TOKEN' : 'WCORE',
        token1Symbol: isToken0 ? 'WCORE' : 'YOUR_TOKEN',
        nativeCoreAmount: ethAmountWei.toString()
      });

      // Step 5: Mint liquidity position on SushiSwap V3 (Core DAO)
      console.log('Step 5: Minting liquidity position on SushiSwap V3...');
      const tx = await writeContractAsync({
        address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS as Address,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "mint",
        args: [mintParams],
        value: ethAmountWei, // Send native CORE which will be wrapped to WCORE automatically
      });
      
      console.log('Liquidity position minted successfully:', tx);
      return tx;
    } catch (error: any) {
      console.error('Error creating DEX pool:', error);
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
      console.log('Adding liquidity with params:', {
        tokenAddress,
        tokenAmount,
        ethAmount,
        fee,
        WETH_ADDRESS,
        contractAddresses,
        isAuthorized
      });

      // Since the DEX Manager doesn't have pool creation functions, 
      // we'll use the SushiSwap V3 approach directly
      console.log('Using direct SushiSwap V3 pool creation approach...');
      
      // Check if token is authorized first
      if (!isAuthorized) {
        console.log('Token not authorized, authorizing first...');
        await writeContractAsync({
          address: contractAddresses.CHAINCRAFT_DEX_MANAGER,
          abi: CHAINCRAFT_DEX_MANAGER_ABI,
          functionName: "authorizeToken",
          args: [tokenAddress],
        });
        console.log('Token authorized successfully');
      }
      
      // Create pool using the direct SushiSwap V3 approach
      const tx = await createDEXPool(tokenAmount, ethAmount, fee);
      
      console.log('Pool created/liquidity added successfully:', tx);
      setPoolExists(true);
      
      // Refetch pool info after creation
      setTimeout(() => {
        refetchPoolInfo();
        refetchTokenStats();
      }, 2000);

      return tx;
    } catch (error: any) {
      console.error('Error in addLiquidity:', error);
      const errorMessage = error?.message || error?.reason || "Failed to add liquidity";
      setError(errorMessage);
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
