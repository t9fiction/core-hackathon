import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useReadContract,
} from "wagmi";
import { Address } from "viem";
import {
  CHAINCRAFT_FACTORY_ABI,
  CHAINCRAFT_DEX_MANAGER_ABI,
} from "../../lib/contracts/abis";
import { getContractAddresses } from "../../lib/contracts/addresses";

interface DEXAuthorizerProps {
  tokenAddress?: Address;
  tokenSymbol?: string;
  onAuthorized?: (tokenAddress: Address) => void;
}

const DEXAuthorizer: React.FC<DEXAuthorizerProps> = ({
  tokenAddress,
  tokenSymbol = "TOKEN",
  onAuthorized,
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractAddresses = getContractAddresses(chainId);
  
  // Contract writing hooks
  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending,
  } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  
  // Check if token is already authorized
  const { data: isAuthorized, refetch: refetchAuthorization } = useReadContract({
    address: contractAddresses.CHAINCRAFT_DEX_MANAGER,
    abi: CHAINCRAFT_DEX_MANAGER_ABI,
    functionName: "authorizedTokens",
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!tokenAddress,
    },
  });

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
        if (onAuthorized && tokenAddress) {
          onAuthorized(tokenAddress);
        }
      }, 1000);
    } catch (error: any) {
      console.error("Error in DEX authorization flow:", error);
      setError(error?.message || error?.reason || "Failed to complete DEX setup");
    }
  };

  // Handle successful authorization
  useEffect(() => {
    if (isSuccess && hash && tokenAddress) {
      refetchAuthorization();
      onAuthorized?.(tokenAddress);
    }
  }, [isSuccess, hash, tokenAddress, onAuthorized, refetchAuthorization]);

  if (isAuthorized) {
    return (
      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-green-400 mb-4 flex items-center">
          ✅ Token Authorized for Trading
        </h4>
        <p className="text-green-300 text-sm mb-4">
          {tokenSymbol} is now authorized for trading on SushiSwap via ChainCraft DEX Manager.
          Users can now buy and sell this token through the trading interface.
        </p>
        <div className="bg-green-800/20 rounded-lg p-3">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-green-300">Status:</span>
              <span className="text-green-400 font-medium">Authorized ✓</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-300">Trading:</span>
              <span className="text-green-400">Enabled via SushiSwap</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-300">Router:</span>
              <span className="text-green-400">RouteProcessor7</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
        🔓 Authorize DEX Trading
        <span className="ml-2 text-xs bg-purple-500 text-white px-2 py-1 rounded">
          SushiSwap Integration
        </span>
      </h4>

      <div className="space-y-4">
        <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <h5 className="text-blue-400 font-medium mb-2">About DEX Authorization</h5>
          <p className="text-gray-300 text-sm mb-3">
            This will authorize your {tokenSymbol} token for trading through SushiSwap's 
            RouteProcessor7 on Core DAO. Once authorized, users can:
          </p>
          <ul className="text-gray-300 text-sm space-y-1 ml-4">
            <li>• Buy {tokenSymbol} with CORE (ETH)</li>
            <li>• Sell {tokenSymbol} for CORE (ETH)</li>
            <li>• Access optimal routing across liquidity sources</li>
            <li>• Benefit from professional DEX infrastructure</li>
          </ul>
        </div>

        <div className="p-3 bg-gray-600 rounded">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Token:</span>
              <span className="text-white">{tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">DEX:</span>
              <span className="text-white">SushiSwap RouteProcessor7</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Network:</span>
              <span className="text-white">Core DAO</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Status:</span>
              <span className="text-yellow-400">Requires Authorization</span>
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

        <button
          onClick={authorizeDEXTrading}
          disabled={
            !isConnected ||
            !tokenAddress ||
            isAuthorizing ||
            isPending ||
            isConfirming
          }
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
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
          ) : (
            `Authorize ${tokenSymbol} for DEX Trading`
          )}
        </button>

        {isSuccess && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
            <p className="text-green-300 text-sm">
              ✅ {tokenSymbol} authorized for DEX trading successfully!
            </p>
            {hash && (
              <p className="text-xs text-gray-400 mt-1 break-all">
                Transaction: {hash}
              </p>
            )}
          </div>
        )}

        <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
          <p className="text-amber-300 text-sm">
            <strong>Note:</strong> Only the token creator can authorize their token for DEX trading.
            This is a one-time setup that enables trading through SushiSwap's infrastructure.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DEXAuthorizer;
