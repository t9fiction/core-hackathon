import React, { useState, useEffect, useRef } from "react";
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
  CHAINCRAFT_DEX_MANAGER_ABI,
} from "../../lib/contracts/abis";
import { getContractAddresses } from "../../lib/contracts/addresses";

interface DEXPoolCreatorProps {
  tokenAddress?: Address;
  tokenSymbol?: string;
  onPoolCreated?: (poolInfo: any) => void;
}

const DEXPoolCreator: React.FC<DEXPoolCreatorProps> = ({
  tokenAddress,
  tokenSymbol = "TOKEN",
  onPoolCreated,
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isApprovingDEX, setIsApprovingDEX] = useState(false);
  const [currentStep, setCurrentStep] = useState<'authorize' | 'approve-factory' | 'approve-dex' | 'create-pool' | 'completed'>('authorize');
  
  // Form data state
  const [formData, setFormData] = useState({
    tokenAmount: "",
    ethAmount: "",
    feeTier: "3000",
  });
  
  // Ref to maintain form data across renders
  const formDataRef = useRef({
    tokenAmount: "",
    ethAmount: "",
    feeTier: "3000",
  });

  const contractAddresses = getContractAddresses(chainId);
  
  // Contract writing hooks
  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending,
  } = useWriteContract();
  
  const {
    writeContract: writeApproval,
    data: approvalTxHash,
    error: approvalError,
    isPending: isApprovalPending,
  } = useWriteContract();
  
  const {
    writeContract: writeDEXApproval,
    data: dexApprovalTxHash,
    error: dexApprovalError,
    isPending: isDEXApprovalPending,
  } = useWriteContract();
  
  const {
    writeContract: writePoolCreation,
    data: poolCreationTxHash,
    error: poolCreationError,
    isPending: isPoolCreationPending,
  } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });
  
  const { isLoading: isDEXApprovalConfirming, isSuccess: isDEXApprovalSuccess } = useWaitForTransactionReceipt({
    hash: dexApprovalTxHash,
  });
  
  const { isLoading: isPoolCreationConfirming, isSuccess: isPoolCreationSuccess } = useWaitForTransactionReceipt({
    hash: poolCreationTxHash,
  });
  
  // Check token allowance for factory
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: "allowance",
    args: address && tokenAddress ? [address, contractAddresses.CHAINCRAFT_FACTORY] : undefined,
    query: {
      enabled: !!(address && tokenAddress),
    },
  });
  
  // Check token allowance for DEX Manager
  const { data: dexAllowance, refetch: refetchDEXAllowance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: "allowance",
    args: address && tokenAddress ? [address, contractAddresses.CHAINCRAFT_DEX_MANAGER] : undefined,
    query: {
      enabled: !!(address && tokenAddress),
    },
  });

  const feeTiers = [
    { value: "500", label: "0.05%", description: "Best for very stable pairs" },
    { value: "3000", label: "0.3%", description: "Most common fee tier" },
    { value: "10000", label: "1%", description: "Best for volatile pairs" },
  ];

  const handleInputChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    formDataRef.current = newFormData;
    setError(null);
  };

  const calculateInitialPrice = () => {
    if (!formData.tokenAmount || !formData.ethAmount) return null;
    const tokenAmount = parseFloat(formData.tokenAmount);
    const ethAmount = parseFloat(formData.ethAmount);
    if (tokenAmount <= 0 || ethAmount <= 0) return null;
    return (tokenAmount / ethAmount).toFixed(2);
  };

  // Check if approval is needed for factory
  const needsApproval = () => {
    if (!tokenAddress || !formData.tokenAmount || allowance === undefined) {
      return false;
    }
    const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
    return BigInt(allowance.toString()) < BigInt(tokenAmountWei.toString());
  };
  
  // Check if DEX approval is needed for token swapping
  const needsDEXApproval = () => {
    if (!tokenAddress || !formData.tokenAmount || dexAllowance === undefined) {
      return false;
    }
    const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
    return BigInt(dexAllowance.toString()) < BigInt(tokenAmountWei.toString());
  };

  // Approve token spending for factory
  const approveToken = async () => {
    if (!tokenAddress || !formData.tokenAmount) {
      setError("Token address and amount are required");
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      
      await writeApproval({
        address: tokenAddress,
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: "approve",
        args: [contractAddresses.CHAINCRAFT_FACTORY, tokenAmountWei],
      });
    } catch (error: any) {
      console.error("Error approving token:", error);
      setError(error?.message || error?.reason || "Failed to approve token");
      setIsApproving(false);
    }
  };

  // Approve token spending for DEX Manager
  const approveDEXManager = async () => {
    if (!tokenAddress || !formData.tokenAmount) {
      setError("Token address and amount are required");
      return;
    }

    setIsApprovingDEX(true);
    setError(null);

    try {
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      
      await writeDEXApproval({
        address: tokenAddress,
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: "approve",
        args: [contractAddresses.CHAINCRAFT_DEX_MANAGER, tokenAmountWei],
      });
    } catch (error: any) {
      console.error("Error approving token for DEX Manager:", error);
      setError(error?.message || error?.reason || "Failed to approve token for DEX Manager");
      setIsApprovingDEX(false);
    }
  };

  const authorizeDEXTrading = async () => {
    if (!tokenAddress) {
      setError("Token address is required");
      return;
    }

    setIsAuthorizing(true);
    setError(null);

    try {
      console.log("Note: DEX authorization not required with SushiSwap V2 direct integration");
      
      // Since we're using direct SushiSwap V2 integration, no authorization is needed
      // Just simulate successful "authorization" for UI purposes
      setTimeout(() => {
        setIsAuthorizing(false);
        setCurrentStep('approve-dex');
      }, 1000);
    } catch (error: any) {
      console.error("Error in DEX authorization flow:", error);
      setError(error?.message || error?.reason || "Failed to complete DEX setup");
      setIsAuthorizing(false);
    }
  };

  const createDEXPool = async () => {
    if (!tokenAddress) {
      setError("Token address is required");
      return;
    }

    if (!formData.ethAmount) {
      setError("Please fill in ETH amount for initial liquidity");
      return;
    }

    const ethAmount = parseFloat(formData.ethAmount);
    if (ethAmount <= 0) {
      setError("ETH amount must be greater than 0");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const ethAmountWei = parseEther(formData.ethAmount);
      
      // Create swap route - simple path from WETH to token
      // This assumes a direct WETH -> Token route exists on SushiSwap
      const path = [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on mainnet
        tokenAddress
      ];
      
      console.log("Creating DEX pool via swap:", {
        tokenAddress,
        ethAmount: formData.ethAmount,
        path,
        contractAddress: contractAddresses.CHAINCRAFT_DEX_MANAGER,
      });

      // Import route calculation for SushiSwap
      const { generateETHToTokenRoute } = await import('../../lib/dex/routeCalculation');
      
      // Generate route bytes for SushiSwap RouteProcessor
      const routeBytes = generateETHToTokenRoute(
        tokenAddress,
        ethAmountWei,
        BigInt(0), // minAmountOut - accept any amount
        address as `0x${string}`,
        contractAddresses.WETH as `0x${string}`
      );
      
      console.log('Generated route:', {
        tokenOut: tokenAddress,
        route: routeBytes,
        ethAmount: ethAmountWei.toString()
      });
      
      // Call DEX Manager to swap ETH for tokens
      await writePoolCreation({
        address: contractAddresses.CHAINCRAFT_DEX_MANAGER,
        abi: CHAINCRAFT_DEX_MANAGER_ABI,
        functionName: "swapETHForTokens",
        args: [
          tokenAddress as `0x${string}`, // tokenOut
          routeBytes as `0x${string}` // route bytes
        ],
        value: ethAmountWei,
      });
      
    } catch (error: any) {
      console.error("Error creating DEX pool:", error);
      setError(error?.message || error?.reason || "Failed to create DEX pool");
      setIsCreating(false);
    }
  };

  // Handle successful approval for factory
  useEffect(() => {
    if (isApprovalSuccess) {
      setIsApproving(false);
      // Refetch allowance after approval
      refetchAllowance();
      setCurrentStep('approve-dex');
    }
  }, [isApprovalSuccess, refetchAllowance]);

  // Handle successful DEX Manager approval
  useEffect(() => {
    if (isDEXApprovalSuccess) {
      setIsApprovingDEX(false);
      // Refetch DEX allowance after approval
      refetchDEXAllowance();
      setCurrentStep('create-pool');
    }
  }, [isDEXApprovalSuccess, refetchDEXAllowance]);

  // Handle successful authorization
  useEffect(() => {
    if (isSuccess && hash) {
      setIsAuthorizing(false);
      setIsAuthorized(true);
      setCurrentStep('approve-factory');
      
      if (onPoolCreated) {
        const currentFormData = formDataRef.current;
        onPoolCreated({
          hash,
          tokenAddress,
          tokenAmount: currentFormData.tokenAmount,
          ethAmount: currentFormData.ethAmount,
          feeTier: currentFormData.feeTier,
          step: 'authorized'
        });
      }
    }
  }, [isSuccess, hash, onPoolCreated, tokenAddress]);

  // Handle successful pool creation
  useEffect(() => {
    if (isPoolCreationSuccess && poolCreationTxHash) {
      setIsCreating(false);
      setCurrentStep('completed');
      
      if (onPoolCreated) {
        const currentFormData = formDataRef.current;
        onPoolCreated({
          hash: poolCreationTxHash,
          tokenAddress,
          tokenAmount: currentFormData.tokenAmount,
          ethAmount: currentFormData.ethAmount,
          feeTier: currentFormData.feeTier,
          step: 'pool-created'
        });
      }
    }
  }, [isPoolCreationSuccess, poolCreationTxHash, onPoolCreated, tokenAddress]);

  const initialPrice = calculateInitialPrice();

  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
        🚀 Authorize Token for DEX Trading
        <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
          Step 1 of 2
        </span>
      </h4>

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm mb-1">
              Token Amount
            </label>
            <input
              type="number"
              value={formData.tokenAmount}
              onChange={(e) => handleInputChange("tokenAmount", e.target.value)}
              placeholder="5000"
              className="w-full p-3 rounded bg-gray-600 border border-gray-500 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1">
              ETH Amount
            </label>
            <input
              type="number"
              value={formData.ethAmount}
              onChange={(e) => handleInputChange("ethAmount", e.target.value)}
              placeholder="1.0"
              step="0.01"
              className="w-full p-3 rounded bg-gray-600 border border-gray-500 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-300 text-sm mb-1">Fee Tier</label>
          <select
            value={formData.feeTier}
            onChange={(e) => handleInputChange("feeTier", e.target.value)}
            className="w-full p-3 rounded bg-gray-600 border border-gray-500 text-white focus:border-blue-500 focus:outline-none"
          >
            {feeTiers.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label} - {tier.description}
              </option>
            ))}
          </select>
        </div>

        {/* Pool Information Preview */}
        <div className="p-3 bg-gray-600 rounded">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Pool Type:</span>
              <span className="text-white">{tokenSymbol} - ETH</span>
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
                  ? `1 ETH = ${initialPrice} ${tokenSymbol}`
                  : "Enter amounts"}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {writeError && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{writeError.message}</p>
          </div>
        )}

        {approvalError && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{approvalError.message}</p>
          </div>
        )}

        {/* Show approve button if approval is needed */}
        {needsApproval() && !isApprovalSuccess ? (
          <button
            onClick={approveToken}
            disabled={
              !isConnected ||
              !tokenAddress ||
              !formData.tokenAmount ||
              isApproving ||
              isApprovalPending ||
              isApprovalConfirming
            }
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors mb-4"
          >
            {isApproving || isApprovalPending || isApprovalConfirming ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {isApproving
                  ? "Approving..."
                  : isApprovalPending
                  ? "Confirming Approval..."
                  : "Processing..."}
              </span>
            ) : (
              `Approve ${tokenSymbol} Spending`
            )}
          </button>
        ) : null}

        <button
          onClick={authorizeDEXTrading}
          disabled={
            !isConnected ||
            !tokenAddress ||
            isAuthorizing ||
            isPending ||
            isConfirming ||
            isAuthorized
          }
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
        >
          {isAuthorizing || isPending || isConfirming ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {isAuthorizing
                ? "Authorizing..."
                : isPending
                ? "Confirming..."
                : "Processing..."}
            </span>
          ) : isAuthorized ? (
            "✅ Token Authorized"
          ) : (
            "Authorize Token for Trading"
          )}
        </button>

        {/* Show DEX Manager approval button if needed */}
        {isSuccess && needsDEXApproval() && !isDEXApprovalSuccess && (
          <button
            onClick={approveDEXManager}
            disabled={
              !isConnected ||
              !tokenAddress ||
              !formData.tokenAmount ||
              isApprovingDEX ||
              isDEXApprovalPending ||
              isDEXApprovalConfirming
            }
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors mb-4"
          >
            {isApprovingDEX || isDEXApprovalPending || isDEXApprovalConfirming ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {isApprovingDEX
                  ? "Approving DEX Manager..."
                  : isDEXApprovalPending
                  ? "Confirming DEX Approval..."
                  : "Processing..."}
              </span>
            ) : (
              `Approve ${tokenSymbol} for DEX Manager`
            )}
          </button>
        )}

        {/* Success messages and next steps */}
        {isSuccess && (
          <div className="space-y-3">
            <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
              <p className="text-green-300 text-sm">
                ✅ Token authorized for DEX trading successfully!
              </p>
              {hash && (
                <p className="text-xs text-gray-400 mt-1 break-all">
                  Transaction: {hash}
                </p>
              )}
            </div>
            
            {/* Show pool creation button when all approvals are done */}
            {(!needsDEXApproval() || isDEXApprovalSuccess) && currentStep !== 'completed' && (
              <div className="p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                <h5 className="text-blue-300 font-medium mb-3 flex items-center">
                  🎯 Final Step: Create Liquidity Pool
                </h5>
                <p className="text-blue-200 text-sm mb-3">
                  Create the initial liquidity pool by swapping ETH for your tokens:
                </p>
                
                <button
                  onClick={createDEXPool}
                  disabled={
                    !isConnected ||
                    !tokenAddress ||
                    !formData.ethAmount ||
                    isCreating ||
                    isPoolCreationPending ||
                    isPoolCreationConfirming
                  }
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors mb-3"
                >
                  {isCreating || isPoolCreationPending || isPoolCreationConfirming ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {isCreating
                        ? "Creating Pool..."
                        : isPoolCreationPending
                        ? "Confirming Pool Creation..."
                        : "Processing..."}
                    </span>
                  ) : (
                    `🚀 Create ${tokenSymbol}/ETH Pool`
                  )}
                </button>
                
                <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded text-xs text-yellow-200">
                  <p className="mb-1"><strong>Note:</strong> This will create the initial liquidity pool using:</p>
                  <p>• {formData.ethAmount || '1.0'} ETH</p>
                  <p>• Your authorized {tokenSymbol} token</p>
                  <p className="mt-1 text-yellow-300">Token Address: {tokenAddress}</p>
                </div>
              </div>
            )}

            {/* Show completion message */}
            {isPoolCreationSuccess && (
              <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
                <p className="text-green-300 text-sm">
                  🎉 Liquidity pool created successfully!
                </p>
                {poolCreationTxHash && (
                  <p className="text-xs text-gray-400 mt-1 break-all">
                    Pool Transaction: {poolCreationTxHash}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DEXPoolCreator;
