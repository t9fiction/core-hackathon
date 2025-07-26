import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseEther, parseUnits, Address } from 'viem';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';

interface LiquidityManagerProps {
  tokenAddress?: Address;
  tokenSymbol?: string;
  onLiquidityAdded?: (txHash: string) => void;
}

const LiquidityManager: React.FC<LiquidityManagerProps> = ({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  onLiquidityAdded
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  const [formData, setFormData] = useState({
    tokenAmount: '',
    ethAmount: ''
  });
  
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractAddresses = getContractAddresses(chainId);
  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const calculateRatio = () => {
    if (!formData.tokenAmount || !formData.ethAmount) return null;
    const tokenAmount = parseFloat(formData.tokenAmount);
    const ethAmount = parseFloat(formData.ethAmount);
    if (tokenAmount <= 0 || ethAmount <= 0) return null;
    return (tokenAmount / ethAmount).toFixed(2);
  };

  const addLiquidity = async () => {
    if (!tokenAddress) {
      setError('Token address is required');
      return;
    }

    if (!formData.tokenAmount || !formData.ethAmount) {
      setError('Please fill in all required fields');
      return;
    }

    const tokenAmount = parseFloat(formData.tokenAmount);
    const ethAmount = parseFloat(formData.ethAmount);

    if (tokenAmount <= 0 || ethAmount <= 0) {
      setError('Amounts must be greater than 0');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      const ethAmountWei = parseEther(formData.ethAmount);

      console.log('Adding liquidity:', {
        tokenAddress,
        tokenAmount: tokenAmountWei.toString(),
        ethAmount: ethAmountWei.toString(),
        contractAddress: contractAddresses.PUMPFUN_FACTORY
      });

      // First approve the factory to spend tokens
      await writeContract({
        address: tokenAddress,
        abi: PUMPFUN_TOKEN_ABI,
        functionName: 'approve',
        args: [contractAddresses.PUMPFUN_FACTORY, tokenAmountWei],
      });

      // Wait a bit for the approval to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Add liquidity via factory
      await writeContract({
        address: contractAddresses.PUMPFUN_FACTORY,
        abi: PUMPFUN_FACTORY_ABI,
        functionName: 'addAndLockLiquidity',
        args: [tokenAddress, tokenAmountWei],
        value: ethAmountWei,
      });

    } catch (error: any) {
      console.error('Error adding liquidity:', error);
      setError(error?.message || error?.reason || 'Failed to add liquidity');
    } finally {
      setIsAdding(false);
    }
  };

  // Handle successful liquidity addition
  useEffect(() => {
    if (isSuccess && hash && onLiquidityAdded) {
      onLiquidityAdded(hash);
      // Reset form
      setFormData({ tokenAmount: '', ethAmount: '' });
    }
  }, [isSuccess, hash, onLiquidityAdded]);

  const ratio = calculateRatio();

  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
        💧 Add Liquidity
      </h4>

      <div className="space-y-4">
        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Token Amount ({tokenSymbol})
          </label>
          <input
            type="number"
            value={formData.tokenAmount}
            onChange={(e) => handleInputChange('tokenAmount', e.target.value)}
            placeholder="10000"
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
            onChange={(e) => handleInputChange('ethAmount', e.target.value)}
            placeholder="1.0"
            step="0.01"
            className="w-full p-3 rounded bg-gray-600 border border-gray-500 text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Ratio Display */}
        {ratio && (
          <div className="p-3 bg-gray-600 rounded">
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Price Ratio:</span>
                <span className="text-white">1 ETH = {ratio} {tokenSymbol}</span>
              </div>
            </div>
          </div>
        )}

        {/* Important Notice */}
        <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded">
          <div className="text-blue-300 text-sm">
            <div className="font-medium mb-1">📝 Important:</div>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Liquidity will be automatically locked for the token&apos;s lock period</li>
              <li>You will receive LP tokens representing your share</li>
              <li>Both tokens will be deposited at the current market ratio</li>
            </ul>
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
          onClick={addLiquidity}
          disabled={
            !isConnected ||
            !tokenAddress ||
            !formData.tokenAmount ||
            !formData.ethAmount ||
            isAdding ||
            isPending ||
            isConfirming
          }
          className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors"
        >
          {isAdding || isPending || isConfirming ? (
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
              {isAdding ? 'Approving...' : isPending ? 'Confirming...' : 'Adding Liquidity...'}
            </span>
          ) : (
            'Add & Lock Liquidity'
          )}
        </button>

        {isSuccess && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
            <p className="text-green-300 text-sm">✅ Liquidity added successfully!</p>
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

export default LiquidityManager;
