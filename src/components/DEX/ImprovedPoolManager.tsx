import React, { useState, useEffect, useRef } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useReadContract,
} from "wagmi";
import { parseEther, parseUnits, Address } from "viem";
import {
  CHAINCRAFT_FACTORY_ABI,
  CHAINCRAFT_TOKEN_ABI,
} from "../../lib/contracts/abis";
import { getContractAddresses } from "../../lib/contracts/addresses";

// SushiSwap V2 Factory ABI (simplified)
const SUSHISWAP_V2_FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
    ],
    name: "createPair",
    outputs: [{ internalType: "address", name: "pair", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
    ],
    name: "getPair",
    outputs: [{ internalType: "address", name: "pair", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// SushiSwap V2 Router ABI
const SUSHISWAP_V2_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amountTokenDesired", type: "uint256" },
      { internalType: "uint256", name: "amountTokenMin", type: "uint256" },
      { internalType: "uint256", name: "amountETHMin", type: "uint256" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "addLiquidityETH",
    outputs: [
      { internalType: "uint256", name: "amountToken", type: "uint256" },
      { internalType: "uint256", name: "amountETH", type: "uint256" },
      { internalType: "uint256", name: "liquidity", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;

interface ImprovedPoolManagerProps {
  tokenAddress?: Address;
  tokenSymbol?: string;
  onPoolCreated?: (poolInfo: any) => void;
}

// SushiSwap V2 addresses on Core DAO - Verified working addresses
const SUSHISWAP_V2_ADDRESSES = {
  1116: { // Core DAO Mainnet
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763", // SushiSwap V2 Factory on Core (verified)
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",  // SushiSwap V2 Router on Core (verified)
  },
  1114: { // Core DAO Testnet2  
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763", // Same for testnet
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",  // Same for testnet
  }
};

const ImprovedPoolManager: React.FC<ImprovedPoolManagerProps> = ({
  tokenAddress,
  tokenSymbol = "TOKEN",
  onPoolCreated,
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [liquidityExecuted, setLiquidityExecuted] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    tokenAmount: "1000",
    coreAmount: "0.1",
  });

  // Contract addresses
  const contractAddresses = getContractAddresses(chainId);
  const sushiV2Addresses = SUSHISWAP_V2_ADDRESSES[chainId as keyof typeof SUSHISWAP_V2_ADDRESSES];

  // Contract writing hooks - we'll use these internally
  const { writeContract: writeAuth, data: authHash, isPending: isAuthorizing } = useWriteContract();
  const { writeContract: writeApproval, data: approvalHash, isPending: isApproving } = useWriteContract();
  const { writeContract: writeCreate, data: createHash, isPending: isCreating } = useWriteContract();
  const { writeContract: writeLiquidity, data: liquidityHash, isPending: isAddingLiquidity } = useWriteContract();

  // Transaction receipts
  const { isSuccess: isAuthSuccess } = useWaitForTransactionReceipt({ hash: authHash });
  const { isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({ hash: approvalHash });
  const { isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({ hash: createHash });
  const { isSuccess: isLiquiditySuccess } = useWaitForTransactionReceipt({ hash: liquidityHash });

  // Check if pair already exists
  const { data: existingPair, isLoading: isCheckingPair, refetch: refetchPairInfo } = useReadContract({
    address: sushiV2Addresses?.factory as Address,
    abi: SUSHISWAP_V2_FACTORY_ABI,
    functionName: "getPair",
    args: tokenAddress && contractAddresses.WETH ? [tokenAddress, contractAddresses.WETH as Address] : undefined,
    query: {
      enabled: !!(tokenAddress && contractAddresses.WETH && sushiV2Addresses?.factory),
    },
  });

  // Check token allowances
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: "allowance",
    args: address && tokenAddress && sushiV2Addresses?.router ? [address, sushiV2Addresses.router as Address] : undefined,
    query: {
      enabled: !!(address && tokenAddress && sushiV2Addresses?.router),
    },
  });

  const pairExists = existingPair && existingPair !== "0x0000000000000000000000000000000000000000";

  // Helper functions
  const needsTokenApproval = () => {
    if (!tokenAllowance || !formData.tokenAmount) return true;
    const requiredAmount = parseUnits(formData.tokenAmount, 18);
    return BigInt(tokenAllowance.toString()) < requiredAmount;
  };

  const calculateInitialPrice = () => {
    if (!formData.tokenAmount || !formData.coreAmount) return null;
    const tokenAmount = parseFloat(formData.tokenAmount);
    const coreAmount = parseFloat(formData.coreAmount);
    if (tokenAmount <= 0 || coreAmount <= 0) return null;
    return (tokenAmount / coreAmount).toFixed(2);
  };

  // Main action handlers - simplified approach for direct SushiSwap interaction
  const handleCreatePoolAndAddLiquidity = async () => {
    if (!tokenAddress || !formData.tokenAmount || !formData.coreAmount) return;
    
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    setLiquidityExecuted(false); // Reset execution flag
    callbackExecutedRef.current = false; // Reset callback flag
    
    try {
      // Check if we need token approval first
      if (needsTokenApproval()) {
        setCurrentStep("Approving token spending for SushiSwap...");
        const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
        await writeApproval({
          address: tokenAddress,
          abi: CHAINCRAFT_TOKEN_ABI,
          functionName: "approve",
          args: [sushiV2Addresses.router as Address, tokenAmountWei],
        });
        return; // Wait for approval success
      }
      
      // If pool doesn't exist, create it first
      if (!pairExists) {
        setCurrentStep("Creating new SushiSwap pool...");
        await createPairOnly();
        return; // Wait for creation success
      }
      
      // If pool exists and approval is done, add liquidity
      await proceedToAddLiquidity();
      
    } catch (err: any) {
      setError(err?.message || "Failed to create pool and add liquidity");
      setIsProcessing(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!tokenAddress || !formData.tokenAmount || !formData.coreAmount) return;
    
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    setLiquidityExecuted(false); // Reset execution flag
    callbackExecutedRef.current = false; // Reset callback flag
    
    try {
      // Check if we need approval first
      if (needsTokenApproval()) {
        setCurrentStep("Approving token spending...");
        const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
        await writeApproval({
          address: tokenAddress as Address,
          abi: CHAINCRAFT_TOKEN_ABI,
          functionName: "approve",
          args: [sushiV2Addresses.router as Address, tokenAmountWei],
        });
        return; // Wait for approval success
      }
      
      // If no approval needed, proceed directly to add liquidity
      await proceedToAddLiquidity();
      
    } catch (err: any) {
      setError(err?.message || "Failed to add liquidity");
      setIsProcessing(false);
    }
  };

  const proceedToAddLiquidity = async () => {
    if (!tokenAddress || !formData.tokenAmount || !formData.coreAmount) return;
    
    try {
      setCurrentStep("Adding liquidity to pool...");
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      const coreAmountWei = parseEther(formData.coreAmount);
      
      // 5% slippage tolerance - minimum amounts
      const minTokenAmount = (tokenAmountWei * 95n) / 100n;
      const minCoreAmount = (coreAmountWei * 95n) / 100n;
      
      // Deadline: 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      
      // Debug calculations
      console.log('Input amounts:', {
        tokenAmountInput: formData.tokenAmount,
        coreAmountInput: formData.coreAmount
      });
      
      console.log('Parsed amounts:', {
        tokenAmountWei: tokenAmountWei.toString(),
        coreAmountWei: coreAmountWei.toString(),
        tokenAmountFormatted: (Number(tokenAmountWei) / 1e18).toFixed(2),
        coreAmountFormatted: (Number(coreAmountWei) / 1e18).toFixed(4)
      });
      
      console.log('Slippage calculations:', {
        minTokenAmount: minTokenAmount.toString(),
        minCoreAmount: minCoreAmount.toString(),
        minTokenFormatted: (Number(minTokenAmount) / 1e18).toFixed(2),
        minCoreFormatted: (Number(minCoreAmount) / 1e18).toFixed(4),
        slippagePercent: '5%'
      });
      
      console.log('Adding liquidity with params:', {
        router: sushiV2Addresses.router,
        token: tokenAddress,
        tokenAmount: tokenAmountWei.toString(),
        minTokenAmount: minTokenAmount.toString(),
        minCoreAmount: minCoreAmount.toString(),
        to: address,
        deadline: deadline.toString(),
        value: coreAmountWei.toString(),
        chainId: chainId
      });

      await writeLiquidity({
        address: sushiV2Addresses.router as Address,
        abi: SUSHISWAP_V2_ROUTER_ABI,
        functionName: "addLiquidityETH",
        args: [
          tokenAddress,
          tokenAmountWei,
          minTokenAmount,
          minCoreAmount,
          address!,
          deadline,
        ],
        value: coreAmountWei,
        gas: 500000n, // Explicit gas limit to avoid estimation issues
      });
    } catch (err: any) {
      console.error('Add liquidity error:', err);
      setError(err?.shortMessage || err?.message || "Failed to add liquidity - please check your token balance and allowance");
      setIsProcessing(false);
    }
  };

  const createPairOnly = async () => {
    if (!tokenAddress || pairExists) return;
    
    try {
      setCurrentStep("Creating new pool...");
      await writeCreate({
        address: sushiV2Addresses.factory as Address,
        abi: SUSHISWAP_V2_FACTORY_ABI,
        functionName: "createPair",
        args: [tokenAddress, contractAddresses.WETH],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to create pair");
      setIsProcessing(false);
    }
  };

  // Handle transaction successes and chain them together - simplified flow
  useEffect(() => {
    if (isAuthSuccess) {
      setCurrentStep("Token authorized! Proceeding to approval...");
      // Auto-proceed to approval after a short delay
      setTimeout(async () => {
        if (needsTokenApproval()) {
          const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
          await writeApproval({
            address: tokenAddress as Address,
            abi: CHAINCRAFT_TOKEN_ABI,
            functionName: "approve",
            args: [sushiV2Addresses.router as Address, tokenAmountWei],
          });
        }
      }, 1000);
    }
  }, [isAuthSuccess, tokenAddress, formData.tokenAmount, sushiV2Addresses?.router, writeApproval]);

  useEffect(() => {
    if (isApprovalSuccess && !liquidityExecuted) {
      refetchAllowance();
      if (pairExists) {
        // If pool exists, proceed directly to add liquidity
        setLiquidityExecuted(true);
        setTimeout(() => proceedToAddLiquidity(), 1000);
      } else {
        // If pool doesn't exist, create it first
        setCurrentStep("Token approved! Creating pool...");
        setTimeout(() => createPairOnly(), 1000);
      }
    }
  }, [isApprovalSuccess, pairExists, refetchAllowance, liquidityExecuted]);

  useEffect(() => {
    if (isCreateSuccess && !liquidityExecuted) {
      setCurrentStep("Pool created! Adding initial liquidity...");
      setLiquidityExecuted(true);
      // Refetch pair info to update UI state
      refetchPairInfo();
      // Auto-proceed to add liquidity after creating pair
      setTimeout(() => proceedToAddLiquidity(), 1000);
    }
  }, [isCreateSuccess, refetchPairInfo, liquidityExecuted]);

  // Use ref to track if callback has been called to prevent multiple calls
  const callbackExecutedRef = useRef(false);
  
  useEffect(() => {
    if (isLiquiditySuccess && !callbackExecutedRef.current) {
      callbackExecutedRef.current = true;
      setSuccess("🎉 Success! Liquidity added to the pool!");
      setCurrentStep("");
      setIsProcessing(false);
      
      if (onPoolCreated) {
        onPoolCreated({
          hash: liquidityHash,
          tokenAddress,
          tokenAmount: formData.tokenAmount,
          coreAmount: formData.coreAmount,
        });
      }
    }
  }, [isLiquiditySuccess, liquidityHash, tokenAddress]); // Removed formData and onPoolCreated from dependencies

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setError(null);
    setSuccess(null);
  };

  const initialPrice = calculateInitialPrice();

  if (!sushiV2Addresses) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6">
        <p className="text-red-300">
          SushiSwap V2 is not available on this network (Chain ID: {chainId})
        </p>
      </div>
    );
  }

  if (!tokenAddress) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
        <div className="text-6xl mb-4">🏗️</div>
        <h3 className="text-xl font-bold text-white mb-2">No Token Selected</h3>
        <p className="text-gray-400">
          Please select a token to create or manage liquidity pools
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pool Status Header */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center">
            <span className="text-blue-400 mr-2">🍣</span>
            {pairExists ? `${tokenSymbol}/CORE Pool` : `Create ${tokenSymbol}/CORE Pool`}
          </h2>
          {pairExists && (
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
              <span className="text-green-400 text-sm font-medium">Pool Active</span>
            </div>
          )}
        </div>

        {/* Pool Status */}
        {isCheckingPair ? (
          <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <p className="text-blue-200 text-sm">🔍 Checking pool status...</p>
          </div>
        ) : pairExists ? (
          <div className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
            <p className="text-green-300 text-sm">
              ✅ Pool is active! Add more liquidity to earn fees from trades.
            </p>
            <p className="text-green-200 text-xs mt-1">
              Pool Address: {existingPair}
            </p>
            <div className="mt-2">
              <a 
                href={`https://scan.coredao.org/address/${existingPair}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-xs underline"
              >
                View Pool on Core Scan →
              </a>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
            <p className="text-yellow-300 text-sm">
              💡 No pool exists yet. Create the first {tokenSymbol}/CORE pool!
            </p>
            <p className="text-yellow-200 text-xs mt-1">
              Note: SushiSwap V2 uses a fixed 0.3% fee tier
            </p>
          </div>
        )}
      </div>

      {/* Main Action Interface */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">
          {pairExists ? 'Add More Liquidity' : 'Create Pool & Add Liquidity'}
        </h3>

        {/* Amount Inputs */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-300 text-sm mb-1">
              {tokenSymbol} Amount
            </label>
            <input
              type="number"
              value={formData.tokenAmount}
              onChange={(e) => handleInputChange("tokenAmount", e.target.value)}
              placeholder="1000"
              disabled={isProcessing}
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1">
              CORE Amount
            </label>
            <input
              type="number"
              value={formData.coreAmount}
              onChange={(e) => handleInputChange("coreAmount", e.target.value)}
              placeholder="0.1"
              step="0.01"
              disabled={isProcessing}
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Pool Info Preview */}
        <div className="p-3 bg-gray-700 rounded mb-4">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Pool Type:</span>
              <span className="text-white">{tokenSymbol}/CORE V2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Fee Tier:</span>
              <span className="text-white">0.3% (SushiSwap Fixed)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">DEX:</span>
              <span className="text-white">SushiSwap V2</span>
            </div>
            {initialPrice && (
              <div className="flex justify-between">
                <span className="text-gray-300">Price:</span>
                <span className="text-white">1 CORE = {initialPrice} {tokenSymbol}</span>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Progress Display */}
        {isProcessing && (
          <div className="p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg mb-4">
            <h4 className="text-blue-200 font-semibold mb-3 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
              Transaction in Progress
            </h4>
            
            {/* Step Indicators */}
            <div className="space-y-2">
              {/* Step 1: Token Approval (only shown when needed) */}
              {(needsTokenApproval() || isApproving || isApprovalSuccess) && (
                <div className={`flex items-center text-sm ${
                  isApproving || isApprovalSuccess ? 'text-blue-300' : 
                  currentStep.includes('Approving') ? 'text-blue-400' :
                  'text-gray-500'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 ${
                    isApprovalSuccess ? 'bg-green-500 text-white' :
                    isApproving || currentStep.includes('Approving') ? 'bg-blue-500 text-white animate-pulse' :
                    'bg-gray-600 text-gray-400'
                  }`}>
                    {isApprovalSuccess ? '✓' : '1'}
                  </div>
                  <div>
                    <span className="font-medium">Approve Token for SushiSwap</span>
                    {isApproving && <span className="ml-2 text-xs">(Check MetaMask)</span>}
                  </div>
                </div>
              )}


              {/* Step 2: Create Pool (conditional) */}
              {!pairExists && (
                <div className={`flex items-center text-sm ${
                  isCreating || isCreateSuccess ? 'text-blue-300' : 
                  currentStep.includes('Creating') ? 'text-blue-400' :
                  'text-gray-500'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 ${
                    isCreateSuccess ? 'bg-green-500 text-white' :
                    isCreating || currentStep.includes('Creating') ? 'bg-blue-500 text-white animate-pulse' :
                    'bg-gray-600 text-gray-400'
                  }`}>
                    {isCreateSuccess ? '✓' : '2'}
                  </div>
                  <div>
                    <span className="font-medium">Create SushiSwap Pool</span>
                    {isCreating && <span className="ml-2 text-xs">(Check MetaMask)</span>}
                  </div>
                </div>
              )}

              {/* Final Step: Add Liquidity */}
              <div className={`flex items-center text-sm ${
                isAddingLiquidity || isLiquiditySuccess ? 'text-blue-300' : 
                currentStep.includes('Adding liquidity') ? 'text-blue-400' :
                'text-gray-500'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 ${
                  isLiquiditySuccess ? 'bg-green-500 text-white' :
                  isAddingLiquidity || currentStep.includes('Adding liquidity') ? 'bg-blue-500 text-white animate-pulse' :
                  'bg-gray-600 text-gray-400'
                }`}>
                  {isLiquiditySuccess ? '✓' : pairExists ? (needsTokenApproval() ? '2' : '1') : '3'}
                </div>
                <div>
                  <span className="font-medium">Add Liquidity to SushiSwap Pool</span>
                  {isAddingLiquidity && <span className="ml-2 text-xs">(Check MetaMask)</span>}
                </div>
              </div>
            </div>

            {/* Current Action Description */}
            {currentStep && (
              <div className="mt-3 p-2 bg-blue-800/50 rounded text-xs text-blue-200">
                <strong>Current:</strong> {currentStep}
              </div>
            )}

            {/* MetaMask Help */}
            <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-500/30 rounded text-xs text-yellow-200">
              <strong>💡 Note:</strong> Each step requires a separate MetaMask confirmation. Please check your wallet when prompted.
            </div>
          </div>
        )}

        {/* Success Messages */}
        {success && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg mb-4">
            <p className="text-green-300 text-sm">{success}</p>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg mb-4">
            <p className="text-red-300 text-sm">❌ {error}</p>
          </div>
        )}

        {/* Main Action Buttons */}
        <div className="space-y-3">
          {pairExists ? (
            // For existing pools - just show "Add Liquidity" (direct SushiSwap approach)
            <button
              onClick={handleAddLiquidity}
              disabled={!isConnected || isProcessing || !formData.tokenAmount || !formData.coreAmount}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 text-white py-4 px-4 rounded-lg font-medium transition-colors text-lg"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Processing...
                </span>
              ) : (
                `💧 Add ${formData.tokenAmount} ${tokenSymbol} + ${formData.coreAmount} CORE`
              )}
            </button>
          ) : (
            // For new pools - show "Create Pool & Add Liquidity" (direct SushiSwap approach)
            <button
              onClick={handleCreatePoolAndAddLiquidity}
              disabled={!isConnected || isProcessing || !formData.tokenAmount || !formData.coreAmount}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 text-white py-4 px-4 rounded-lg font-medium transition-colors text-lg"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Processing...
                </span>
              ) : (
                `🚀 Create Pool + Add ${formData.tokenAmount} ${tokenSymbol} + ${formData.coreAmount} CORE`
              )}
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">What happens:</h4>
          <div className="text-xs text-gray-400 space-y-1">
            {pairExists ? (
              <>
                <p>• Your tokens will be approved for SushiSwap (if needed)</p>
                <p>• Liquidity will be added directly to the SushiSwap pool</p>
                <p>• You'll receive SLP tokens representing your share</p>
                <p>• You'll earn 0.3% fees from all trades</p>
              </>
            ) : (
              <>
                <p>• Token spending will be approved for SushiSwap (if needed)</p>
                <p>• New {tokenSymbol}/CORE pool will be created on SushiSwap</p>
                <p>• Initial liquidity will be added directly to the pool</p>
                <p>• Trading will be enabled immediately</p>
                <p>• No DEX authorization required - direct SushiSwap interaction</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pool Information */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">Technical Details</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-300">Token:</span>
            <span className="text-white font-mono text-xs">{tokenAddress}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Pool Status:</span>
            <span className={pairExists ? "text-green-400" : "text-yellow-400"}>
              {pairExists ? "Active" : "Not Created"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Fee Structure:</span>
            <span className="text-white">0.3% to LP holders</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Network:</span>
            <span className="text-white">Core DAO ({chainId})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImprovedPoolManager;
