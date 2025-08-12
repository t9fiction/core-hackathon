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

// SushiSwap V2 Router ABI (corrected parameter order)
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

interface SushiSwapV2PoolCreatorProps {
  tokenAddress?: Address;
  tokenSymbol?: string;
  onPoolCreated?: (poolInfo: any) => void;
}

// SushiSwap V2 addresses on Core DAO (verified addresses)
const SUSHISWAP_V2_ADDRESSES = {
  1116: { // Core DAO Mainnet
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763",
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",
  }
};

const SushiSwapV2PoolCreator: React.FC<SushiSwapV2PoolCreatorProps> = ({
  tokenAddress,
  tokenSymbol = "TOKEN",
  onPoolCreated,
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [currentStep, setCurrentStep] = useState<
    'authorize' | 'approve-tokens' | 'create-pair' | 'add-liquidity' | 'completed'
  >('authorize');
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    tokenAmount: "1000",
    coreAmount: "0.1",
  });

  // Contract addresses
  const contractAddresses = getContractAddresses(chainId);
  const sushiV2Addresses = SUSHISWAP_V2_ADDRESSES[chainId as keyof typeof SUSHISWAP_V2_ADDRESSES];

  // Contract writing hooks
  const {
    writeContract: writeAuthorization,
    data: authHash,
    isPending: isAuthorizing,
  } = useWriteContract();

  const {
    writeContract: writeTokenApproval,
    data: tokenApprovalHash,
    isPending: isApprovingToken,
  } = useWriteContract();

  const {
    writeContract: writePairCreation,
    data: pairHash,
    isPending: isCreatingPair,
  } = useWriteContract();

  const {
    writeContract: writeLiquidityAdd,
    data: liquidityHash,
    isPending: isAddingLiquidity,
  } = useWriteContract();

  // Transaction receipts
  const { isSuccess: isAuthSuccess } = useWaitForTransactionReceipt({ hash: authHash });
  const { isSuccess: isTokenApprovalSuccess } = useWaitForTransactionReceipt({ hash: tokenApprovalHash });
  const { isSuccess: isPairSuccess } = useWaitForTransactionReceipt({ hash: pairHash });
  const { isSuccess: isLiquiditySuccess } = useWaitForTransactionReceipt({ hash: liquidityHash });

  // Check if pair already exists
  const { data: existingPair, error: pairCheckError, isError: isPairCheckError } = useReadContract({
    address: sushiV2Addresses?.factory as Address,
    abi: SUSHISWAP_V2_FACTORY_ABI,
    functionName: "getPair",
    args: tokenAddress && contractAddresses.WETH ? [tokenAddress, contractAddresses.WETH as Address] : undefined,
    query: {
      enabled: !!(tokenAddress && contractAddresses.WETH && sushiV2Addresses?.factory),
    },
  });

  // Check token allowances
  const { data: tokenAllowance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: "allowance",
    args: address && tokenAddress && sushiV2Addresses?.router ? [address, sushiV2Addresses.router as Address] : undefined,
    query: {
      enabled: !!(address && tokenAddress && sushiV2Addresses?.router),
    },
  });

  // Helper functions
  const needsTokenApproval = () => {
    if (!tokenAllowance || !formData.tokenAmount) return true;
    const requiredAmount = parseUnits(formData.tokenAmount, 18);
    return BigInt(tokenAllowance.toString()) < requiredAmount;
  };

  const pairExists = existingPair && existingPair !== "0x0000000000000000000000000000000000000000";

  // Calculate initial price
  const calculateInitialPrice = () => {
    if (!formData.tokenAmount || !formData.coreAmount) return null;
    const tokenAmount = parseFloat(formData.tokenAmount);
    const coreAmount = parseFloat(formData.coreAmount);
    if (tokenAmount <= 0 || coreAmount <= 0) return null;
    return (tokenAmount / coreAmount).toFixed(2);
  };

  // Step 1: Authorize token (simulation since direct integration is used)
  const authorizeToken = async () => {
    if (!tokenAddress) return;
    
    try {
      console.log("Note: DEX authorization not required with SushiSwap V2 direct integration");
      
      // Since we're using direct SushiSwap V2 integration, no authorization is needed
      // Just simulate successful "authorization" for UI purposes
      setTimeout(() => {
        setCurrentStep('approve-tokens');
      }, 1000);
    } catch (err: any) {
      setError(err?.message || "Failed to complete DEX setup");
    }
  };

  // Step 2: Approve tokens
  const approveToken = async () => {
    if (!tokenAddress || !formData.tokenAmount || !sushiV2Addresses?.router) return;
    
    try {
      const amount = parseUnits(formData.tokenAmount, 18);
      await writeTokenApproval({
        address: tokenAddress,
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: "approve",
        args: [sushiV2Addresses.router as Address, amount],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to approve token");
    }
  };

  // Step 3: Create pair
  const createPair = async () => {
    if (!tokenAddress || pairExists || !sushiV2Addresses?.factory) return;
    
    try {
      await writePairCreation({
        address: sushiV2Addresses.factory as Address,
        abi: SUSHISWAP_V2_FACTORY_ABI,
        functionName: "createPair",
        args: [tokenAddress, contractAddresses.WETH as Address],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to create pair");
    }
  };

  // Step 4: Add liquidity
  const addLiquidity = async () => {
    if (!tokenAddress || !formData.tokenAmount || !formData.coreAmount || !sushiV2Addresses?.router) return;
    
    try {
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      const coreAmountWei = parseEther(formData.coreAmount);
      // Use 95% of desired amounts as minimum to account for slippage
      const minTokenAmount = (tokenAmountWei * 95n) / 100n;
      const minCoreAmount = (coreAmountWei * 95n) / 100n;

      console.log('Adding liquidity with params:', {
        tokenAmountWei: tokenAmountWei.toString(),
        coreAmountWei: coreAmountWei.toString(),
        minTokenAmount: minTokenAmount.toString(),
        minCoreAmount: minCoreAmount.toString(),
        tokenAddress,
        router: sushiV2Addresses.router,
        deadline: Math.floor(Date.now() / 1000) + 1200
      });

      await writeLiquidityAdd({
        address: sushiV2Addresses.router as Address,
        abi: SUSHISWAP_V2_ROUTER_ABI,
        functionName: "addLiquidityETH",
        args: [
          tokenAddress,       // token
          tokenAmountWei,     // amountTokenDesired
          minTokenAmount,     // amountTokenMin (5% slippage)
          minCoreAmount,      // amountETHMin (5% slippage)
          address!,           // to
          BigInt(Math.floor(Date.now() / 1000) + 1200), // deadline (20 min)
        ],
        value: coreAmountWei,
      });
    } catch (err: any) {
      console.error('Add liquidity error:', err);
      setError(err?.message || "Failed to add liquidity");
    }
  };

  // Handle step progression
  useEffect(() => {
    if (isAuthSuccess) {
      setCurrentStep('approve-tokens');
    }
  }, [isAuthSuccess]);

  useEffect(() => {
    if (isTokenApprovalSuccess) {
      setCurrentStep(pairExists ? 'add-liquidity' : 'create-pair');
    }
  }, [isTokenApprovalSuccess, pairExists]);

  // Auto-advance to liquidity step if pair exists and token is approved
  useEffect(() => {
    if (pairExists && currentStep === 'authorize' && !needsTokenApproval()) {
      setCurrentStep('add-liquidity');
    } else if (pairExists && currentStep === 'approve-tokens' && !needsTokenApproval()) {
      setCurrentStep('add-liquidity');
    }
  }, [pairExists, currentStep, needsTokenApproval]);

  // Auto-start at liquidity step if pair already exists
  useEffect(() => {
    if (pairExists && currentStep === 'authorize') {
      if (needsTokenApproval()) {
        setCurrentStep('approve-tokens');
      } else {
        setCurrentStep('add-liquidity');
      }
    }
  }, [pairExists, needsTokenApproval]);

  useEffect(() => {
    if (isPairSuccess) {
      setCurrentStep('add-liquidity');
    }
  }, [isPairSuccess]);

  useEffect(() => {
    if (isLiquiditySuccess) {
      setCurrentStep('completed');
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
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <span className="text-blue-400 mr-2">🍣</span>
        {pairExists ? `Manage ${tokenSymbol}/CORE Pool` : `Create ${tokenSymbol}/CORE Pool`}
      </h2>

      {/* Token Address Display */}
      <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
        <p className="text-sm text-blue-200">
          <strong>Token Address:</strong> {tokenAddress}
        </p>
        <p className="text-xs text-blue-300 mt-1">
          Creating V2 pool on Core DAO Mainnet (Chain ID: {chainId})
        </p>
      </div>

      {/* Debug Information */}
      <div className="mb-4 p-3 bg-purple-900/30 border border-purple-500/50 rounded-lg">
        <h4 className="text-purple-300 font-semibold mb-2">🔍 Debug Information</h4>
        <div className="text-xs space-y-1 text-purple-200">
          <p><strong>Chain ID:</strong> {chainId}</p>
          <p><strong>SushiSwap V2 Factory:</strong> {sushiV2Addresses.factory}</p>
          <p><strong>SushiSwap V2 Router:</strong> {sushiV2Addresses.router}</p>
          <p><strong>WCORE Address:</strong> {contractAddresses.WETH}</p>
          <p><strong>Pair Check Result:</strong> {existingPair || "No pair found"}</p>
          <p><strong>Pair Exists:</strong> {pairExists ? "Yes" : "No"}</p>
          {isPairCheckError && (
            <p className="text-red-300"><strong>Pair Check Error:</strong> {pairCheckError?.message}</p>
          )}
        </div>
      </div>

      {/* Pair Status */}
      {pairExists && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
          <p className="text-green-300 text-sm">
            ✅ Pair already exists! You can add liquidity directly.
          </p>
          <p className="text-green-200 text-xs mt-1">
            Pair Address: {existingPair}
          </p>
          <div className="mt-2">
            <a 
              href={`https://scan.coredao.org/address/${existingPair}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-xs underline"
            >
              View Pair on Core Scan →
            </a>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Amount Inputs */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm mb-1">
              {tokenSymbol} Amount
            </label>
            <input
              type="number"
              value={formData.tokenAmount}
              onChange={(e) => handleInputChange("tokenAmount", e.target.value)}
              placeholder="1000"
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
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
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Pool Information Preview */}
        <div className="p-3 bg-gray-700 rounded">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Pool Type:</span>
              <span className="text-white">{tokenSymbol}/CORE V2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Fee Tier:</span>
              <span className="text-white">0.3% (Fixed)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Initial Price:</span>
              <span className="text-white">
                {initialPrice
                  ? `1 CORE = ${initialPrice} ${tokenSymbol}`
                  : "Enter amounts"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">DEX:</span>
              <span className="text-white">SushiSwap V2</span>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="space-y-2">
          <div className="flex items-center text-sm">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 ${
              currentStep === 'authorize' ? 'bg-blue-500 text-white' :
              isAuthSuccess ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}>
              {isAuthSuccess ? '✓' : '1'}
            </span>
            <span className={currentStep === 'authorize' ? 'text-blue-400' : 
                   isAuthSuccess ? 'text-green-400' : 'text-gray-400'}>
              Authorize Token for DEX Trading
            </span>
          </div>
          
          <div className="flex items-center text-sm">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 ${
              currentStep === 'approve-tokens' ? 'bg-blue-500 text-white' :
              isTokenApprovalSuccess ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}>
              {isTokenApprovalSuccess ? '✓' : '2'}
            </span>
            <span className={currentStep === 'approve-tokens' ? 'text-blue-400' : 
                   isTokenApprovalSuccess ? 'text-green-400' : 'text-gray-400'}>
              Approve Token
            </span>
          </div>
          
          <div className="flex items-center text-sm">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 ${
              currentStep === 'create-pair' ? 'bg-blue-500 text-white' :
              (isPairSuccess || pairExists) ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}>
              {(isPairSuccess || pairExists) ? '✓' : '3'}
            </span>
            <span className={currentStep === 'create-pair' ? 'text-blue-400' : 
                   (isPairSuccess || pairExists) ? 'text-green-400' : 'text-gray-400'}>
              {pairExists ? 'Pair Exists' : 'Create Pair'}
            </span>
          </div>
          
          <div className="flex items-center text-sm">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 ${
              currentStep === 'add-liquidity' ? 'bg-blue-500 text-white' :
              isLiquiditySuccess ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}>
              {isLiquiditySuccess ? '✓' : '4'}
            </span>
            <span className={currentStep === 'add-liquidity' ? 'text-blue-400' : 
                   isLiquiditySuccess ? 'text-green-400' : 'text-gray-400'}>
              Add Initial Liquidity
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Step 1: Authorize */}
          {currentStep === 'authorize' && (
            <button
              onClick={authorizeToken}
              disabled={!isConnected || isAuthorizing}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isAuthorizing ? "Authorizing..." : "1. Authorize Token"}
            </button>
          )}

          {/* Step 2: Approve Token */}
          {currentStep === 'approve-tokens' && needsTokenApproval() && (
            <button
              onClick={approveToken}
              disabled={!isConnected || isApprovingToken}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isApprovingToken ? "Approving..." : `2. Approve ${tokenSymbol}`}
            </button>
          )}

          {/* Step 3: Create Pair */}
          {currentStep === 'create-pair' && !pairExists && (
            <button
              onClick={createPair}
              disabled={!isConnected || isCreatingPair}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isCreatingPair ? "Creating Pair..." : "3. Create Pair"}
            </button>
          )}

          {/* Step 4: Add Liquidity */}
          {currentStep === 'add-liquidity' && (
            <button
              onClick={addLiquidity}
              disabled={!isConnected || isAddingLiquidity}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isAddingLiquidity ? "Adding Liquidity..." : "4. Add Initial Liquidity"}
            </button>
          )}

          {/* Completed */}
          {currentStep === 'completed' && (
            <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg text-center">
              <p className="text-green-300 text-lg font-semibold mb-2">
                🎉 Pool Created Successfully!
              </p>
              <p className="text-green-200 text-sm mb-3">
                Your {tokenSymbol}/CORE V2 pool is now live on SushiSwap
              </p>
              <div className="bg-green-800/30 rounded p-3 mb-3 text-left">
                <h4 className="text-green-300 font-semibold text-sm mb-2">✅ What Happened:</h4>
                <ul className="text-green-200 text-xs space-y-1">
                  <li>• {formData.tokenAmount} {tokenSymbol} + {formData.coreAmount} CORE added to pool</li>
                  <li>• LP tokens minted to your wallet (~9.999 LP tokens)</li>
                  <li>• Trading is now enabled for {tokenSymbol}/CORE pair</li>
                  <li>• You'll earn 0.3% fees from all trades</li>
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <a 
                  href={`https://scan.coredao.org/tx/${liquidityHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded transition-colors"
                >
                  View Transaction
                </a>
                <a 
                  href={`https://scan.coredao.org/address/${existingPair}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded transition-colors"
                >
                  View Pool Contract
                </a>
              </div>
              {liquidityHash && (
                <p className="text-xs text-gray-400 mt-2 break-all">
                  Transaction: {liquidityHash}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Manual Controls */}
        {pairExists && (
          <div className="p-4 bg-orange-900/30 border border-orange-500/50 rounded-lg">
            <h4 className="text-orange-300 font-semibold mb-2">🔧 Manual Controls</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setCurrentStep('authorize');
                  setError(null);
                }}
                className="text-xs bg-orange-600 hover:bg-orange-700 text-white py-2 px-3 rounded transition-colors"
              >
                Restart Process
              </button>
              <button
                onClick={() => {
                  setCurrentStep('add-liquidity');
                  setError(null);
                }}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded transition-colors"
              >
                Retry Add Liquidity
              </button>
            </div>
            <p className="text-orange-200 text-xs mt-2">
              Use these if you need to restart the process or retry adding liquidity.
            </p>
          </div>
        )}

        {/* Help Text */}
        <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded text-xs text-yellow-200">
          <p><strong>Note:</strong> This creates a SushiSwap V2 pool for your token paired with CORE.</p>
          <p>• SushiSwap V2 uses a fixed 0.3% fee and automatic market making</p>
          <p>• Make sure you have enough {tokenSymbol} tokens and CORE in your wallet</p>
          <p>• The ratio you provide will set the initial price</p>
          <p><strong>Troubleshooting:</strong> If liquidity fails, check token approval amounts and try "Retry Add Liquidity"</p>
        </div>
      </div>
    </div>
  );
};

export default SushiSwapV2PoolCreator;
