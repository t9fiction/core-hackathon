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

interface SmartPoolManagerProps {
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

const SmartPoolManager: React.FC<SmartPoolManagerProps> = ({
  tokenAddress,
  tokenSymbol = "TOKEN",
  onPoolCreated,
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [currentAction, setCurrentAction] = useState<'authorize' | 'approve' | 'create' | 'add-liquidity' | 'completed'>('authorize');
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

  // Contract writing hooks
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
  const { data: existingPair, isLoading: isCheckingPair } = useReadContract({
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

  // Actions
  const authorizeToken = async () => {
    if (!tokenAddress) return;
    
    try {
      setError(null);
      await writeAuth({
        address: contractAddresses.CHAINCRAFT_FACTORY,
        abi: CHAINCRAFT_FACTORY_ABI,
        functionName: "authorizeDEXTrading",
        args: [tokenAddress],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to authorize token");
    }
  };

  const approveToken = async () => {
    if (!tokenAddress || !formData.tokenAmount || !sushiV2Addresses?.router) return;
    
    try {
      setError(null);
      const amount = parseUnits(formData.tokenAmount, 18);
      await writeApproval({
        address: tokenAddress,
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: "approve",
        args: [sushiV2Addresses.router as Address, amount],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to approve token");
    }
  };

  const createPair = async () => {
    if (!tokenAddress || pairExists || !sushiV2Addresses?.factory) return;
    
    try {
      setError(null);
      await writeCreate({
        address: sushiV2Addresses.factory as Address,
        abi: SUSHISWAP_V2_FACTORY_ABI,
        functionName: "createPair",
        args: [tokenAddress, contractAddresses.WETH],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to create pair");
    }
  };

  const addLiquidity = async () => {
    if (!tokenAddress || !formData.tokenAmount || !formData.coreAmount || !sushiV2Addresses?.router) return;
    
    try {
      setError(null);
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      const coreAmountWei = parseEther(formData.coreAmount);
      const minTokenAmount = (tokenAmountWei * 95n) / 100n;
      const minCoreAmount = (coreAmountWei * 95n) / 100n;

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
          BigInt(Math.floor(Date.now() / 1000) + 1200),
        ],
        value: coreAmountWei,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to add liquidity");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setError(null);
    setSuccess(null);
  };

  // Handle transaction success
  useEffect(() => {
    if (isAuthSuccess) {
      setSuccess("Token authorized successfully!");
      setCurrentAction('approve');
    }
  }, [isAuthSuccess]);

  useEffect(() => {
    if (isApprovalSuccess) {
      setSuccess("Token approved successfully!");
      if (pairExists) {
        setCurrentAction('add-liquidity');
      } else {
        setCurrentAction('create');
      }
    }
  }, [isApprovalSuccess, pairExists]);

  useEffect(() => {
    if (isCreateSuccess) {
      setSuccess("Pool created successfully!");
      setCurrentAction('add-liquidity');
    }
  }, [isCreateSuccess]);

  useEffect(() => {
    if (isLiquiditySuccess) {
      setSuccess("Liquidity added successfully!");
      setCurrentAction('completed');
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

  // Auto-determine starting action based on pool state
  useEffect(() => {
    if (pairExists && !isCheckingPair) {
      if (needsTokenApproval()) {
        setCurrentAction('approve');
      } else {
        setCurrentAction('add-liquidity');
      }
    }
  }, [pairExists, isCheckingPair, needsTokenApproval]);

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
            <p className="text-blue-200 text-sm">🔍 Checking if pool exists...</p>
          </div>
        ) : pairExists ? (
          <div className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
            <p className="text-green-300 text-sm">
              ✅ Pool exists! You can add more liquidity to support trading.
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
                View on Core Scan →
              </a>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
            <p className="text-yellow-300 text-sm">
              💡 No pool exists yet. Create the first {tokenSymbol}/CORE pool to enable trading!
            </p>
          </div>
        )}
      </div>

      {/* Main Action Interface */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">
          {pairExists ? 'Add Liquidity' : 'Create Pool & Add Initial Liquidity'}
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
            {initialPrice && (
              <div className="flex justify-between">
                <span className="text-gray-300">Price:</span>
                <span className="text-white">1 CORE = {initialPrice} {tokenSymbol}</span>
              </div>
            )}
          </div>
        </div>

        {/* Success Messages */}
        {success && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg mb-4">
            <p className="text-green-300 text-sm">✅ {success}</p>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg mb-4">
            <p className="text-red-300 text-sm">❌ {error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {currentAction === 'authorize' && (
            <button
              onClick={authorizeToken}
              disabled={!isConnected || isAuthorizing}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isAuthorizing ? "Authorizing..." : "🔑 Authorize Token for Trading"}
            </button>
          )}

          {currentAction === 'approve' && needsTokenApproval() && (
            <button
              onClick={approveToken}
              disabled={!isConnected || isApproving}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isApproving ? "Approving..." : `✅ Approve ${tokenSymbol} Spending`}
            </button>
          )}

          {currentAction === 'create' && !pairExists && (
            <button
              onClick={createPair}
              disabled={!isConnected || isCreating}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isCreating ? "Creating Pool..." : "🏗️ Create Pool"}
            </button>
          )}

          {currentAction === 'add-liquidity' && (
            <button
              onClick={addLiquidity}
              disabled={!isConnected || isAddingLiquidity || !formData.tokenAmount || !formData.coreAmount}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isAddingLiquidity ? "Adding Liquidity..." : `💧 ${pairExists ? 'Add More Liquidity' : 'Add Initial Liquidity'}`}
            </button>
          )}

          {currentAction === 'completed' && (
            <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg text-center">
              <p className="text-green-300 text-lg font-semibold mb-2">
                🎉 Success!
              </p>
              <p className="text-green-200 text-sm mb-3">
                {formData.tokenAmount} {tokenSymbol} + {formData.coreAmount} CORE added to the pool
              </p>
              <div className="grid grid-cols-2 gap-2">
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
                  View Pool
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions for Existing Pools */}
        {pairExists && currentAction !== 'completed' && (
          <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Quick Actions:</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setCurrentAction('add-liquidity');
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-3 rounded transition-colors"
              >
                Add More Liquidity
              </button>
              <button
                onClick={() => {
                  setCurrentAction('authorize');
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Information Panel */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">Pool Information</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-300">Token:</span>
            <span className="text-white">{tokenSymbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">DEX:</span>
            <span className="text-white">SushiSwap V2</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Network:</span>
            <span className="text-white">Core DAO ({chainId})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Pool Status:</span>
            <span className={pairExists ? "text-green-400" : "text-yellow-400"}>
              {pairExists ? "Active" : "Not Created"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartPoolManager;
