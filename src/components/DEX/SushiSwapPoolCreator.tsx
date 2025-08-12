import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useReadContract,
} from "wagmi";
import { parseEther, parseUnits, Address, encodePacked, keccak256 } from "viem";
import {
  CHAINCRAFT_FACTORY_ABI,
  CHAINCRAFT_TOKEN_ABI,
  UNISWAP_V3_FACTORY_ABI,
  NONFUNGIBLE_POSITION_MANAGER_ABI,
} from "../../lib/contracts/abis";
import { getContractAddresses } from "../../lib/contracts/addresses";
import { getSushiSwapAddresses } from "../../lib/contracts/uniswap-addresses";

interface SushiSwapPoolCreatorProps {
  tokenAddress?: Address;
  tokenSymbol?: string;
  onPoolCreated?: (poolInfo: any) => void;
}

const SushiSwapPoolCreator: React.FC<SushiSwapPoolCreatorProps> = ({
  tokenAddress = "0xe2f50e3fb3946fc890cbf98f5fb404d57c07a949",
  tokenSymbol = "TOKEN",
  onPoolCreated,
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [currentStep, setCurrentStep] = useState<
    'authorize' | 'approve-tokens' | 'create-pool' | 'add-liquidity' | 'completed'
  >('authorize');
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    tokenAmount: "1000",
    coreAmount: "0.1",
    feeTier: "3000", // 0.3%
  });

  // Contract addresses
  const contractAddresses = getContractAddresses(chainId);
  const sushiswapAddresses = getSushiSwapAddresses(chainId);

  // Fee tiers for SushiSwap V3
  const feeTiers = [
    { value: "500", label: "0.05%", description: "Best for very stable pairs" },
    { value: "3000", label: "0.3%", description: "Most common fee tier" },
    { value: "10000", label: "1%", description: "Best for volatile pairs" },
  ];

  // Contract writing hooks
  const {
    writeContract: writeAuthorization,
    data: authHash,
    error: authError,
    isPending: isAuthorizing,
  } = useWriteContract();

  const {
    writeContract: writeTokenApproval,
    data: tokenApprovalHash,
    error: tokenApprovalError,
    isPending: isApprovingToken,
  } = useWriteContract();

  const {
    writeContract: writeCoreApproval,
    data: coreApprovalHash,
    error: coreApprovalError,
    isPending: isApprovingCore,
  } = useWriteContract();

  const {
    writeContract: writePoolCreation,
    data: poolHash,
    error: poolError,
    isPending: isCreatingPool,
  } = useWriteContract();

  const {
    writeContract: writeLiquidityAdd,
    data: liquidityHash,
    error: liquidityError,
    isPending: isAddingLiquidity,
  } = useWriteContract();

  // Transaction receipts
  const { isSuccess: isAuthSuccess } = useWaitForTransactionReceipt({ hash: authHash });
  const { isSuccess: isTokenApprovalSuccess } = useWaitForTransactionReceipt({ hash: tokenApprovalHash });
  const { isSuccess: isCoreApprovalSuccess } = useWaitForTransactionReceipt({ hash: coreApprovalHash });
  const { isSuccess: isPoolSuccess } = useWaitForTransactionReceipt({ hash: poolHash });
  const { isSuccess: isLiquiditySuccess } = useWaitForTransactionReceipt({ hash: liquidityHash });

  // Check if pool already exists
  const { data: existingPool, error: poolCheckError, isError: isPoolCheckError } = useReadContract({
    address: sushiswapAddresses.factory as Address,
    abi: UNISWAP_V3_FACTORY_ABI,
    functionName: "getPool",
    args: [tokenAddress, contractAddresses.WETH, parseInt(formData.feeTier)],
    query: {
      enabled: !!(tokenAddress && contractAddresses.WETH && formData.feeTier && sushiswapAddresses.factory !== "0x0000000000000000000000000000000000000000"),
    },
  });

  // Check token allowances
  const { data: tokenAllowance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: "allowance",
    args: address && tokenAddress ? [address, sushiswapAddresses.positionManager] : undefined,
    query: {
      enabled: !!(address && tokenAddress),
    },
  });

  const { data: wethAllowance } = useReadContract({
    address: contractAddresses.WETH,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: "allowance",
    args: address ? [address, sushiswapAddresses.positionManager] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Helper functions
  const needsTokenApproval = () => {
    if (!tokenAllowance || !formData.tokenAmount) return true;
    const requiredAmount = parseUnits(formData.tokenAmount, 18);
    return BigInt(tokenAllowance.toString()) < requiredAmount;
  };

  const needsCoreApproval = () => {
    if (!wethAllowance || !formData.coreAmount) return true;
    const requiredAmount = parseEther(formData.coreAmount);
    return BigInt(wethAllowance.toString()) < requiredAmount;
  };

  const poolExists = existingPool && existingPool !== "0x0000000000000000000000000000000000000000";

  // Calculate initial price (simplified)
  const calculateInitialPrice = () => {
    if (!formData.tokenAmount || !formData.coreAmount) return null;
    const tokenAmount = parseFloat(formData.tokenAmount);
    const coreAmount = parseFloat(formData.coreAmount);
    if (tokenAmount <= 0 || coreAmount <= 0) return null;
    return (tokenAmount / coreAmount).toFixed(2);
  };

  // Step 1: Authorize token for DEX trading
  const authorizeToken = async () => {
    if (!tokenAddress) return;
    
    try {
      await writeAuthorization({
        address: contractAddresses.CHAINCRAFT_FACTORY,
        abi: CHAINCRAFT_FACTORY_ABI,
        functionName: "authorizeDEXTrading",
        args: [tokenAddress],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to authorize token");
    }
  };

  // Step 2: Approve tokens
  const approveToken = async () => {
    if (!tokenAddress || !formData.tokenAmount) return;
    
    try {
      const amount = parseUnits(formData.tokenAmount, 18);
      await writeTokenApproval({
        address: tokenAddress,
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: "approve",
        args: [sushiswapAddresses.positionManager, amount],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to approve token");
    }
  };

  const approveWCore = async () => {
    if (!formData.coreAmount) return;
    
    try {
      const amount = parseEther(formData.coreAmount);
      await writeCoreApproval({
        address: contractAddresses.WETH, // WCORE
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: "approve",
        args: [sushiswapAddresses.positionManager, amount],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to approve WCORE");
    }
  };

  // Step 3: Create pool
  const createPool = async () => {
    if (!tokenAddress || poolExists) return;
    
    try {
      // Order tokens (SushiSwap requires token0 < token1)
      const token0 = tokenAddress.toLowerCase() < contractAddresses.WETH.toLowerCase() 
        ? tokenAddress 
        : contractAddresses.WETH;
      const token1 = tokenAddress.toLowerCase() < contractAddresses.WETH.toLowerCase() 
        ? contractAddresses.WETH 
        : tokenAddress;

      await writePoolCreation({
        address: sushiswapAddresses.factory as Address,
        abi: UNISWAP_V3_FACTORY_ABI,
        functionName: "createPool",
        args: [token0, token1, parseInt(formData.feeTier)],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to create pool");
    }
  };

  // Step 4: Add initial liquidity
  const addLiquidity = async () => {
    if (!tokenAddress || !formData.tokenAmount || !formData.coreAmount) return;
    
    try {
      // Calculate amounts in wei
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      const coreAmountWei = parseEther(formData.coreAmount);

      // Order tokens for the mint params
      const isTokenFirst = tokenAddress.toLowerCase() < contractAddresses.WETH.toLowerCase();
      
      const mintParams = {
        token0: isTokenFirst ? tokenAddress : contractAddresses.WETH,
        token1: isTokenFirst ? contractAddresses.WETH : tokenAddress,
        fee: parseInt(formData.feeTier),
        tickLower: -887220, // Full range liquidity
        tickUpper: 887220,
        amount0Desired: isTokenFirst ? tokenAmountWei : coreAmountWei,
        amount1Desired: isTokenFirst ? coreAmountWei : tokenAmountWei,
        amount0Min: 0n, // Accept any amount of tokens
        amount1Min: 0n,
        recipient: address!,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 minutes from now
      };

      await writeLiquidityAdd({
        address: sushiswapAddresses.positionManager as Address,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "mint",
        args: [mintParams],
        value: coreAmountWei, // Send CORE to be wrapped to WCORE
      });
    } catch (err: any) {
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
    if (isTokenApprovalSuccess && isCoreApprovalSuccess) {
      setCurrentStep(poolExists ? 'add-liquidity' : 'create-pool');
    }
  }, [isTokenApprovalSuccess, isCoreApprovalSuccess, poolExists]);

  useEffect(() => {
    if (isPoolSuccess) {
      setCurrentStep('add-liquidity');
    }
  }, [isPoolSuccess]);

  useEffect(() => {
    if (isLiquiditySuccess) {
      setCurrentStep('completed');
      if (onPoolCreated) {
        onPoolCreated({
          hash: liquidityHash,
          tokenAddress,
          tokenAmount: formData.tokenAmount,
          coreAmount: formData.coreAmount,
          feeTier: formData.feeTier,
        });
      }
    }
  }, [isLiquiditySuccess, liquidityHash, onPoolCreated, tokenAddress, formData]);

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setError(null);
  };

  const initialPrice = calculateInitialPrice();

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <span className="text-blue-400 mr-2">🍣</span>
        Create SushiSwap Pool
      </h2>

      {/* Token Address Display */}
      <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
        <p className="text-sm text-blue-200">
          <strong>Token Address:</strong> {tokenAddress}
        </p>
        <p className="text-xs text-blue-300 mt-1">
          Creating pool on Core DAO Mainnet (Chain ID: {chainId})
        </p>
      </div>

      {/* Debug Information */}
      <div className="mb-4 p-3 bg-purple-900/30 border border-purple-500/50 rounded-lg">
        <h4 className="text-purple-300 font-semibold mb-2">🔍 Debug Information</h4>
        <div className="text-xs space-y-1 text-purple-200">
          <p><strong>Chain ID:</strong> {chainId}</p>
          <p><strong>SushiSwap Factory:</strong> {sushiswapAddresses.factory}</p>
          <p><strong>Position Manager:</strong> {sushiswapAddresses.positionManager}</p>
          <p><strong>WCORE Address:</strong> {contractAddresses.WETH}</p>
          <p><strong>Pool Check Result:</strong> {existingPool || "No pool found"}</p>
          <p><strong>Pool Exists:</strong> {poolExists ? "Yes" : "No"}</p>
          {isPoolCheckError && (
            <p className="text-red-300"><strong>Pool Check Error:</strong> {poolCheckError?.message}</p>
          )}
        </div>
      </div>

      {/* Pool Status */}
      {poolExists && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
          <p className="text-green-300 text-sm">
            ✅ Pool already exists! You can add liquidity directly.
          </p>
          <p className="text-green-200 text-xs mt-1">
            Pool Address: {existingPool}
          </p>
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

        {/* Fee Tier */}
        <div>
          <label className="block text-gray-300 text-sm mb-1">Fee Tier</label>
          <select
            value={formData.feeTier}
            onChange={(e) => handleInputChange("feeTier", e.target.value)}
            className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
          >
            {feeTiers.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label} - {tier.description}
              </option>
            ))}
          </select>
        </div>

        {/* Pool Information Preview */}
        <div className="p-3 bg-gray-700 rounded">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Pool Type:</span>
              <span className="text-white">{tokenSymbol}/CORE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Fee Tier:</span>
              <span className="text-white">
                {feeTiers.find((t) => t.value === formData.feeTier)?.label}
              </span>
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
              <span className="text-white">SushiSwap V3</span>
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
              (isTokenApprovalSuccess && isCoreApprovalSuccess) ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}>
              {(isTokenApprovalSuccess && isCoreApprovalSuccess) ? '✓' : '2'}
            </span>
            <span className={currentStep === 'approve-tokens' ? 'text-blue-400' : 
                   (isTokenApprovalSuccess && isCoreApprovalSuccess) ? 'text-green-400' : 'text-gray-400'}>
              Approve Tokens
            </span>
          </div>
          
          <div className="flex items-center text-sm">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 ${
              currentStep === 'create-pool' ? 'bg-blue-500 text-white' :
              (isPoolSuccess || poolExists) ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}>
              {(isPoolSuccess || poolExists) ? '✓' : '3'}
            </span>
            <span className={currentStep === 'create-pool' ? 'text-blue-400' : 
                   (isPoolSuccess || poolExists) ? 'text-green-400' : 'text-gray-400'}>
              {poolExists ? 'Pool Exists' : 'Create Pool'}
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

          {/* Step 2: Approve Tokens */}
          {currentStep === 'approve-tokens' && (
            <>
              {needsTokenApproval() && (
                <button
                  onClick={approveToken}
                  disabled={!isConnected || isApprovingToken}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
                >
                  {isApprovingToken ? "Approving..." : `2a. Approve ${tokenSymbol}`}
                </button>
              )}
              
              {needsCoreApproval() && (
                <button
                  onClick={approveWCore}
                  disabled={!isConnected || isApprovingCore}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
                >
                  {isApprovingCore ? "Approving..." : "2b. Approve WCORE"}
                </button>
              )}
            </>
          )}

          {/* Step 3: Create Pool */}
          {currentStep === 'create-pool' && !poolExists && (
            <button
              onClick={createPool}
              disabled={!isConnected || isCreatingPool}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isCreatingPool ? "Creating Pool..." : "3. Create Pool"}
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
              <p className="text-green-200 text-sm">
                Your {tokenSymbol}/CORE pool is now live on SushiSwap
              </p>
              {liquidityHash && (
                <p className="text-xs text-gray-400 mt-2 break-all">
                  Transaction: {liquidityHash}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded text-xs text-yellow-200">
          <p><strong>Note:</strong> This will create a SushiSwap V3 pool for your token paired with CORE.</p>
          <p>• Make sure you have enough {tokenSymbol} tokens and CORE in your wallet</p>
          <p>• The initial liquidity will determine the starting price of your token</p>
          <p>• You can add more liquidity later or let others trade in your pool</p>
        </div>
      </div>
    </div>
  );
};

export default SushiSwapPoolCreator;
