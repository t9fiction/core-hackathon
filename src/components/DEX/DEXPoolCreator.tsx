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
  PUMPFUN_FACTORY_ABI,
  PUMPFUN_TOKEN_ABI,
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

  const [formData, setFormData] = useState({
    tokenAmount: "",
    ethAmount: "",
    feeTier: "3000",
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const formDataRef = useRef(formData);

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
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });
  
  // Check token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: "allowance",
    args: address && tokenAddress ? [address, contractAddresses.PUMPFUN_FACTORY] : undefined,
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

  // Check if approval is needed
  const needsApproval = () => {
    if (!tokenAddress || !formData.tokenAmount || allowance === undefined) {
      return false;
    }
    const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
    return BigInt(allowance.toString()) < BigInt(tokenAmountWei.toString());
  };

  // Approve token spending
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
        abi: PUMPFUN_TOKEN_ABI,
        functionName: "approve",
        args: [contractAddresses.PUMPFUN_FACTORY, tokenAmountWei],
      });
    } catch (error: any) {
      console.error("Error approving token:", error);
      setError(error?.message || error?.reason || "Failed to approve token");
      setIsApproving(false);
    }
  };

  const createDEXPool = async () => {
    if (!tokenAddress) {
      setError("Token address is required");
      return;
    }

    if (!formData.tokenAmount || !formData.ethAmount) {
      setError("Please fill in all required fields");
      return;
    }

    const tokenAmount = parseFloat(formData.tokenAmount);
    const ethAmount = parseFloat(formData.ethAmount);

    if (tokenAmount <= 0 || ethAmount <= 0) {
      setError("Amounts must be greater than 0");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      const ethAmountWei = parseEther(formData.ethAmount);
      const fee = parseInt(formData.feeTier);

      console.log("Creating DEX pool:", {
        tokenAddress,
        tokenAmount: tokenAmountWei.toString(),
        ethAmount: ethAmountWei.toString(),
        fee,
        contractAddress: contractAddresses.PUMPFUN_FACTORY,
      });

      // Create pool via factory
      await writeContract({
        address: contractAddresses.PUMPFUN_FACTORY,
        abi: PUMPFUN_FACTORY_ABI,
        functionName: "createDEXPool",
        args: [tokenAddress, tokenAmountWei, fee],
        value: ethAmountWei,
      });
    } catch (error: any) {
      console.error("Error creating DEX pool:", error);
      setError(error?.message || error?.reason || "Failed to create DEX pool");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle successful approval
  useEffect(() => {
    if (isApprovalSuccess) {
      setIsApproving(false);
      // Refetch allowance after approval
      refetchAllowance();
    }
  }, [isApprovalSuccess, refetchAllowance]);

  // Handle successful pool creation
  useEffect(() => {
    if (isSuccess && hash && onPoolCreated) {
      const currentFormData = formDataRef.current;
      onPoolCreated({
        hash,
        tokenAddress,
        tokenAmount: currentFormData.tokenAmount,
        ethAmount: currentFormData.ethAmount,
        feeTier: currentFormData.feeTier,
      });
      // Reset form
      const resetData = { tokenAmount: "", ethAmount: "", feeTier: "3000" };
      setFormData(resetData);
      formDataRef.current = resetData;
    }
  }, [isSuccess, hash, onPoolCreated, tokenAddress]);

  const initialPrice = calculateInitialPrice();

  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
        🚀 Create DEX Pool
        <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
          Factory Function
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
          onClick={createDEXPool}
          disabled={
            !isConnected ||
            !tokenAddress ||
            !formData.tokenAmount ||
            !formData.ethAmount ||
            needsApproval() ||
            isCreating ||
            isPending ||
            isConfirming
          }
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
        >
          {isCreating || isPending || isConfirming ? (
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
                : isPending
                ? "Confirming..."
                : "Processing..."}
            </span>
          ) : (
            "Create DEX Pool"
          )}
        </button>

        {isSuccess && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
            <p className="text-green-300 text-sm">
              ✅ DEX Pool created successfully!
            </p>
            {hash && (
              <p className="text-xs text-gray-400 mt-1 break-all">
                Transaction: {hash}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DEXPoolCreator;
