import React, { useState, useEffect } from "react";
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
} from "../../lib/contracts/abis";
import { getContractAddresses } from "../../lib/contracts/addresses";
import { useSmartApproval, TokenApprovalConfig } from "../../lib/hooks/useSmartApproval";
import { COMMON_SPENDERS } from "../../lib/utils/approvalUtils";

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

interface UniversalPoolManagerProps {
  tokenAddress?: Address;
  tokenSymbol?: string;
  onPoolCreated?: (poolInfo: any) => void;
}

// SushiSwap V2 addresses on Core DAO
const SUSHISWAP_V2_ADDRESSES = {
  1116: { // Core DAO Mainnet
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763",
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",
  }
};

const UniversalPoolManager: React.FC<UniversalPoolManagerProps> = ({
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
  
  // Form data
  const [formData, setFormData] = useState({
    tokenAmount: "1000",
    coreAmount: "0.1",
  });

  // Contract addresses
  const contractAddresses = getContractAddresses(chainId);
  const sushiV2Addresses = SUSHISWAP_V2_ADDRESSES[chainId as keyof typeof SUSHISWAP_V2_ADDRESSES];

  // Check if pair already exists
  const { data: existingPair, isLoading: isCheckingPair } = useReadContract({
    address: sushiV2Addresses?.factory as Address,
    abi: SUSHISWAP_V2_FACTORY_ABI,
    functionName: "getPair",
    args: [tokenAddress, contractAddresses.WETH],
    query: {
      enabled: !!(tokenAddress && contractAddresses.WETH && sushiV2Addresses?.factory),
    },
  });

  const pairExists = existingPair && existingPair !== "0x0000000000000000000000000000000000000000";

  // Configure token approvals using our universal utility
  const tokenConfigs: TokenApprovalConfig[] = tokenAddress ? [
    {
      tokenAddress,
      spenderAddress: COMMON_SPENDERS.SUSHISWAP_V2_ROUTER,
      amount: formData.tokenAmount,
      decimals: 18,
      enableMaxApproval: true, // Use max approval for better UX
    },
  ] : [];

  // Smart approval hook
  const {
    isProcessing: isProcessingApprovals,
    allApprovalsComplete,
    hasErrors: hasApprovalErrors,
    tokenStates,
    executeApprovals,
    statusMessage: approvalStatusMessage,
  } = useSmartApproval({
    userAddress: address,
    tokenConfigs,
    onAllApprovalsComplete: () => {
      console.log('All approvals completed, proceeding with next step');
    },
    onApprovalError: (tokenAddress, error) => {
      console.error(`Approval failed for ${tokenAddress}:`, error);
      setError(`Approval failed: ${error}`);
    },
  });

  // Contract writing hooks for authorization, pair creation, and liquidity
  const { writeContract: writeAuth, data: authHash, isPending: isAuthorizing } = useWriteContract();
  const { writeContract: writeCreate, data: createHash, isPending: isCreating } = useWriteContract();
  const { writeContract: writeLiquidity, data: liquidityHash, isPending: isAddingLiquidity } = useWriteContract();

  // Transaction receipts
  const { isSuccess: isAuthSuccess } = useWaitForTransactionReceipt({ hash: authHash });
  const { isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({ hash: createHash });
  const { isSuccess: isLiquiditySuccess } = useWaitForTransactionReceipt({ hash: liquidityHash });

  // Main action handlers
  const handleCreatePoolAndAddLiquidity = async () => {
    if (!tokenAddress || !formData.tokenAmount || !formData.coreAmount) return;
    
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Step 1: Authorize token for DEX trading
      setCurrentStep("Authorizing token for DEX trading...");
      writeAuth({
        address: contractAddresses.CHAINCRAFT_FACTORY,
        abi: CHAINCRAFT_FACTORY_ABI,
        functionName: "authorizeDEXTrading",
        args: [tokenAddress],
      });
      
    } catch (err: any) {
      setError(err?.message || "Failed to authorize token");
      setIsProcessing(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!tokenAddress || !formData.tokenAmount || !formData.coreAmount) return;
    
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Check if we need approvals first
      if (!allApprovalsComplete) {
        setCurrentStep("Processing token approvals...");
        await executeApprovals();
        return; // Wait for approval completion
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
      const minTokenAmount = (tokenAmountWei * 95n) / 100n;
      const minCoreAmount = (coreAmountWei * 95n) / 100n;

      writeLiquidity({
        address: sushiV2Addresses.router as Address,
        abi: SUSHISWAP_V2_ROUTER_ABI,
        functionName: "addLiquidityETH",
        args: [
          tokenAddress,
          tokenAmountWei,
          minTokenAmount,
          minCoreAmount,
          address!,
          BigInt(Math.floor(Date.now() / 1000) + 1200),
        ],
        value: coreAmountWei,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to add liquidity");
      setIsProcessing(false);
    }
  };

  const createPairOnly = async () => {
    if (!tokenAddress || pairExists) return;
    
    try {
      setCurrentStep("Creating new pool...");
      writeCreate({
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

  // Handle transaction successes and chain them together
  useEffect(() => {
    if (isAuthSuccess) {
      setCurrentStep("Token authorized! Processing approvals...");
      // Auto-proceed to approvals
      setTimeout(() => executeApprovals(), 1000);
    }
  }, [isAuthSuccess, executeApprovals]);

  useEffect(() => {
    if (allApprovalsComplete && isProcessing) {
      if (pairExists) {
        // If pool exists, proceed directly to add liquidity
        setTimeout(() => proceedToAddLiquidity(), 1000);
      } else {
        // If pool doesn't exist, create it first
        setCurrentStep("Approvals complete! Creating pool...");
        setTimeout(() => createPairOnly(), 1000);
      }
    }
  }, [allApprovalsComplete, pairExists, isProcessing]);

  useEffect(() => {
    if (isCreateSuccess) {
      setCurrentStep("Pool created! Adding initial liquidity...");
      // Auto-proceed to add liquidity after creating pair
      setTimeout(() => proceedToAddLiquidity(), 1000);
    }
  }, [isCreateSuccess]);

  useEffect(() => {
    if (isLiquiditySuccess) {
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
  }, [isLiquiditySuccess, liquidityHash, onPoolCreated, tokenAddress, formData]);

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setError(null);
    setSuccess(null);
  };

  const calculateInitialPrice = () => {
    if (!formData.tokenAmount || !formData.coreAmount) return null;
    const tokenAmount = parseFloat(formData.tokenAmount);
    const coreAmount = parseFloat(formData.coreAmount);
    if (tokenAmount <= 0 || coreAmount <= 0) return null;
    return (tokenAmount / coreAmount).toFixed(2);
  };

  const initialPrice = calculateInitialPrice();
  const isProcessingOverall = isProcessing || isProcessingApprovals;
  const statusMessage = isProcessing ? currentStep : approvalStatusMessage;

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
              disabled={isProcessingOverall}
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
              disabled={isProcessingOverall}
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

        {/* Approval Progress (when processing approvals) */}
        {tokenStates.size > 0 && (
          <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg mb-4">
            <div className="space-y-2">
              <p className="text-blue-300 text-sm font-medium">Token Approvals:</p>
              {Array.from(tokenStates.values()).map(state => (
                <div key={state.tokenAddress} className="flex items-center gap-3 text-sm">
                  {state.isProcessing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  ) : state.step === 'completed' ? (
                    <div className="h-4 w-4 text-green-400">✓</div>
                  ) : state.step === 'error' ? (
                    <div className="h-4 w-4 text-red-400">✗</div>
                  ) : (
                    <div className="h-4 w-4 text-yellow-400">○</div>
                  )}
                  <span className="text-blue-200 capitalize">{state.step}</span>
                  <span className="text-blue-300 text-xs">{state.spenderName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Step Display */}
        {isProcessingOverall && statusMessage && (
          <div className="p-3 bg-blue-900/50 border border-blue-500 rounded-lg mb-4">
            <p className="text-blue-300 text-sm flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
              {statusMessage}
            </p>
          </div>
        )}

        {/* Success Messages */}
        {success && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg mb-4">
            <p className="text-green-300 text-sm">{success}</p>
          </div>
        )}

        {/* Error Messages */}
        {(error || hasApprovalErrors) && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg mb-4">
            <p className="text-red-300 text-sm">❌ {error || "Approval failed"}</p>
          </div>
        )}

        {/* Main Action Buttons */}
        <div className="space-y-3">
          {pairExists ? (
            // For existing pools - just show "Add Liquidity"
            <button
              onClick={handleAddLiquidity}
              disabled={!isConnected || isProcessingOverall || !formData.tokenAmount || !formData.coreAmount}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 text-white py-4 px-4 rounded-lg font-medium transition-colors text-lg"
            >
              {isProcessingOverall ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Processing...
                </span>
              ) : (
                `💧 Add ${formData.tokenAmount} ${tokenSymbol} + ${formData.coreAmount} CORE`
              )}
            </button>
          ) : (
            // For new pools - show "Create Pool & Add Liquidity"
            <button
              onClick={handleCreatePoolAndAddLiquidity}
              disabled={!isConnected || isProcessingOverall || !formData.tokenAmount || !formData.coreAmount}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 text-white py-4 px-4 rounded-lg font-medium transition-colors text-lg"
            >
              {isProcessingOverall ? (
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
                <p>• Token approvals handled automatically (if needed)</p>
                <p>• Liquidity will be added to the existing pool</p>
                <p>• You'll receive LP tokens representing your share</p>
                <p>• You'll earn 0.3% fees from all trades</p>
              </>
            ) : (
              <>
                <p>• Token will be authorized for DEX trading</p>
                <p>• Token approvals handled automatically</p>
                <p>• New {tokenSymbol}/CORE pool will be created</p>
                <p>• Initial liquidity will be added to the pool</p>
                <p>• Trading will be enabled for your token</p>
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

export default UniversalPoolManager;
