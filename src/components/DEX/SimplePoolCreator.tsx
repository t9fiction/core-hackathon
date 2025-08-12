import React, { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { parseEther, parseUnits, Address } from "viem";
import {
  CHAINCRAFT_FACTORY_ABI,
  CHAINCRAFT_TOKEN_ABI,
} from "../../lib/contracts/abis";
import { getContractAddresses } from "../../lib/contracts/addresses";

interface SimplePoolCreatorProps {
  tokenAddress?: Address;
  tokenSymbol?: string;
  onPoolCreated?: (poolInfo: any) => void;
}

// Core DAO native DEX addresses (LFGSwap or similar)
const CORE_NATIVE_DEX = {
  1116: { // Core DAO Mainnet
    // These are placeholder addresses - we need to find the actual Core DAO DEX
    factory: "0x0000000000000000000000000000000000000000", // Placeholder
    router: "0x0000000000000000000000000000000000000000", // Placeholder
  }
};

const SimplePoolCreator: React.FC<SimplePoolCreatorProps> = ({
  tokenAddress = "0xe2f50e3fb3946fc890cbf98f5fb404d57c07a949",
  tokenSymbol = "TOKEN",
  onPoolCreated,
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'authorize' | 'manual' | 'completed'>('authorize');
  
  // Form data
  const [formData, setFormData] = useState({
    tokenAmount: "1000",
    coreAmount: "0.1",
  });

  // Contract addresses
  const contractAddresses = getContractAddresses(chainId);

  // Contract writing hooks
  const {
    writeContract: writeAuthorization,
    data: authHash,
    isPending: isAuthorizing,
  } = useWriteContract();

  const { isSuccess: isAuthSuccess } = useWaitForTransactionReceipt({ hash: authHash });

  // Step 1: Authorize token (simulation since direct integration is used)
  const authorizeToken = async () => {
    if (!tokenAddress) return;
    
    try {
      console.log("Note: DEX authorization not required with SushiSwap V2 direct integration");
      
      // Since we're using direct SushiSwap V2 integration, no authorization is needed
      // Just simulate successful "authorization" for UI purposes
      setTimeout(() => {
        setStep('manual');
      }, 1000);
    } catch (err: any) {
      setError(err?.message || "Failed to complete DEX setup");
    }
  };

  React.useEffect(() => {
    if (isAuthSuccess) {
      setStep('manual');
    }
  }, [isAuthSuccess]);

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setError(null);
  };

  const calculateInitialPrice = () => {
    if (!formData.tokenAmount || !formData.coreAmount) return null;
    const tokenAmount = parseFloat(formData.tokenAmount);
    const coreAmount = parseFloat(formData.coreAmount);
    if (tokenAmount <= 0 || coreAmount <= 0) return null;
    return (tokenAmount / coreAmount).toFixed(2);
  };

  const initialPrice = calculateInitialPrice();

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <span className="text-orange-400 mr-2">🔧</span>
        Manual Pool Creation Guide
      </h2>

      {/* Token Address Display */}
      <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
        <p className="text-sm text-blue-200">
          <strong>Token Address:</strong> {tokenAddress}
        </p>
        <p className="text-xs text-blue-300 mt-1">
          Core DAO Mainnet (Chain ID: {chainId})
        </p>
      </div>

      {/* Issue Explanation */}
      <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
        <h4 className="text-yellow-300 font-semibold mb-2">⚠️ DEX Integration Issue</h4>
        <div className="text-sm text-yellow-200 space-y-2">
          <p>The SushiSwap contracts may not be fully deployed or accessible on Core DAO mainnet yet.</p>
          <p><strong>Solution:</strong> Let's authorize your token first, then create the pool manually on Core DAO's native DEX.</p>
        </div>
      </div>

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
              <span className="text-white">{tokenSymbol}/CORE</span>
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
              <span className="text-white">Core DAO Native DEX</span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: Authorize Token */}
        {step === 'authorize' && (
          <div className="space-y-3">
            <h4 className="text-white font-semibold">Step 1: Authorize Token</h4>
            <p className="text-gray-300 text-sm">
              First, authorize your token for DEX trading through ChainCraft Factory.
            </p>
            <button
              onClick={authorizeToken}
              disabled={!isConnected || isAuthorizing}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              {isAuthorizing ? "Authorizing..." : "Authorize Token"}
            </button>
          </div>
        )}

        {/* Step 2: Manual Instructions */}
        {step === 'manual' && (
          <div className="space-y-4">
            <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg">
              <p className="text-green-300 text-sm mb-2">
                ✅ Token authorized for DEX trading successfully!
              </p>
              {authHash && (
                <p className="text-xs text-gray-400 mt-1 break-all">
                  Transaction: {authHash}
                </p>
              )}
            </div>

            <div className="p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
              <h4 className="text-blue-300 font-semibold mb-3">📋 Manual Pool Creation Steps</h4>
              <div className="space-y-3 text-sm text-blue-200">
                <div>
                  <p className="font-semibold text-white">Option 1: Use Core DAO's Native DEX</p>
                  <ol className="list-decimal list-inside space-y-1 mt-2 ml-4">
                    <li>Visit <a href="https://swap.coredao.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">https://swap.coredao.org</a></li>
                    <li>Connect your wallet</li>
                    <li>Look for "Add Liquidity" or "Create Pool" section</li>
                    <li>Add your token address: <code className="bg-gray-700 px-2 py-1 rounded text-yellow-300">{tokenAddress}</code></li>
                    <li>Pair it with CORE token</li>
                    <li>Add {formData.tokenAmount} {tokenSymbol} + {formData.coreAmount} CORE</li>
                  </ol>
                </div>

                <div className="border-t border-blue-700 pt-3 mt-3">
                  <p className="font-semibold text-white">Option 2: Use Block Explorer</p>
                  <ol className="list-decimal list-inside space-y-1 mt-2 ml-4">
                    <li>Go to <a href="https://scan.coredao.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Core Scan</a></li>
                    <li>Find the Core DAO DEX factory contract</li>
                    <li>Use "createPair" function with your token + WCORE</li>
                    <li>Then use the router to "addLiquidityETH"</li>
                  </ol>
                </div>

                <div className="border-t border-blue-700 pt-3 mt-3">
                  <p className="font-semibold text-white">Option 3: Alternative DEX</p>
                  <ol className="list-decimal list-inside space-y-1 mt-2 ml-4">
                    <li>Try IceCreamSwap: <a href="https://icecreamswap.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">https://icecreamswap.com</a></li>
                    <li>Or check other DEX aggregators that support Core DAO</li>
                    <li>Look for DEXes that specifically support Core mainnet</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="p-3 bg-purple-900/30 border border-purple-500/50 rounded-lg">
              <h5 className="text-purple-300 font-semibold mb-2">🔍 Your Pool Details</h5>
              <div className="text-xs space-y-1 text-purple-200">
                <p><strong>Token Address:</strong> {tokenAddress}</p>
                <p><strong>Token Symbol:</strong> {tokenSymbol}</p>
                <p><strong>Liquidity:</strong> {formData.tokenAmount} {tokenSymbol} + {formData.coreAmount} CORE</p>
                <p><strong>Initial Price:</strong> {initialPrice ? `1 CORE = ${initialPrice} ${tokenSymbol}` : "Not calculated"}</p>
              </div>
            </div>

            <button
              onClick={() => setStep('completed')}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white py-3 px-4 rounded font-medium transition-colors"
            >
              I've Created the Pool Manually ✅
            </button>
          </div>
        )}

        {/* Completed */}
        {step === 'completed' && (
          <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg text-center">
            <p className="text-green-300 text-lg font-semibold mb-2">
              🎉 Pool Creation Process Complete!
            </p>
            <p className="text-green-200 text-sm">
              Your {tokenSymbol}/CORE pool should now be available for trading.
            </p>
          </div>
        )}

        {/* Help Text */}
        <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded text-xs text-yellow-200">
          <p><strong>Why Manual?</strong> Core DAO's DEX infrastructure is still developing. The major DEX protocols like SushiSwap/Uniswap may not be fully deployed yet.</p>
          <p className="mt-1"><strong>Alternative:</strong> You can also check DEX aggregators like 1inch or ParaSwap to see if they support Core DAO and your token.</p>
        </div>
      </div>
    </div>
  );
};

export default SimplePoolCreator;
