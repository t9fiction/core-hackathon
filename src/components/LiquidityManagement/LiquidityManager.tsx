import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useReadContract } from 'wagmi';
import { parseEther, parseUnits, Address, formatUnits } from 'viem';
import { PUMPFUN_FACTORY_ABI } from '../../lib/contracts/abis';
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

  // Fetch available token balance from factory pool
  const { data: availableTokenBalance, refetch: refetchBalance } = useReadContract({
    address: contractAddresses.PUMPFUN_FACTORY,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: 'tokenLiquidityPoolBalance',
    args: tokenAddress ? [tokenAddress] : undefined,
    enabled: !!tokenAddress,
  });

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

    // Check if requested amount exceeds available balance
    if (availableTokenBalance) {
      const availableBalance = parseFloat(formatUnits(availableTokenBalance as bigint, 18));
      if (tokenAmount > availableBalance) {
        setError(`Requested amount (${tokenAmount}) exceeds available balance (${availableBalance.toFixed(2)})`);
        return;
      }
    }

    setIsAdding(true);
    setError(null);

    try {
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      const ethAmountWei = parseEther(formData.ethAmount);

      console.log('Locking tokens:', {
        tokenAddress,
        tokenAmount: tokenAmountWei.toString(),
        ethAmount: ethAmountWei.toString(),
        contractAddress: contractAddresses.PUMPFUN_FACTORY
      });

      // Lock tokens and ETH via factory (no approval needed - tokens come from factory pool)
      await writeContract({
        address: contractAddresses.PUMPFUN_FACTORY,
        abi: PUMPFUN_FACTORY_ABI,
        functionName: 'addAndLockLiquidity',
        args: [tokenAddress, tokenAmountWei],
        value: ethAmountWei,
      });

    } catch (error: any) {
      console.error('Error locking tokens:', error);
      setError(error?.message || error?.reason || 'Failed to lock tokens');
    } finally {
      setIsAdding(false);
    }
  };

  // Handle successful token locking
  useEffect(() => {
    if (isSuccess && hash && onLiquidityAdded) {
      onLiquidityAdded(hash);
      // Reset form and refresh balance
      setFormData({ tokenAmount: '', ethAmount: '' });
      refetchBalance();
    }
  }, [isSuccess, hash, onLiquidityAdded, refetchBalance]);

  const ratio = calculateRatio();

  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
        🔒 Lock Tokens for Trust Building
      </h4>

      <div className="space-y-4">
        {/* Available Balance Display */}
        {availableTokenBalance && (
          <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <div className="text-blue-200 text-sm">
              <div className="font-medium text-blue-300 mb-1">📊 Available for Locking:</div>
              <div className="text-lg font-semibold">
                {parseFloat(formatUnits(availableTokenBalance as bigint, 18)).toFixed(2)} {tokenSymbol}
              </div>
              <div className="text-xs text-blue-300 mt-1">
                (From factory's allocated pool balance)
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Token Amount ({tokenSymbol})
          </label>
          <input
            type="number"
            value={formData.tokenAmount}
            onChange={(e) => handleInputChange('tokenAmount', e.target.value)}
            placeholder="10000"
            max={availableTokenBalance ? formatUnits(availableTokenBalance as bigint, 18) : undefined}
            className="w-full p-3 rounded bg-gray-600 border border-gray-500 text-white focus:border-blue-500 focus:outline-none"
          />
          {availableTokenBalance && (
            <div className="text-xs text-gray-400 mt-1">
              Max: {parseFloat(formatUnits(availableTokenBalance as bigint, 18)).toFixed(2)} {tokenSymbol}
            </div>
          )}
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
        <div className="p-4 bg-gradient-to-r from-orange-900/30 to-yellow-900/30 border border-orange-500/50 rounded-lg">
          <div className="text-orange-200 text-sm">
            <div className="font-medium mb-2 text-orange-300">🛡️ Anti-Rug Pull Mechanism:</div>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>This is NOT adding liquidity to Uniswap</strong></li>
              <li>Tokens will be locked in the factory contract for the specified period</li>
              <li>This builds community trust by preventing immediate token dumps</li>
              <li>Locked tokens cannot be accessed until the lock period expires</li>
              <li>ETH sent will be held alongside the locked tokens</li>
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
              {isAdding ? 'Processing...' : isPending ? 'Confirming...' : 'Locking Tokens...'}
            </span>
          ) : (
            'Lock Tokens & ETH'
          )}
        </button>

        {isSuccess && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
            <p className="text-green-300 text-sm">✅ Tokens and ETH locked successfully!</p>
            <p className="text-green-200 text-xs mt-1">Your tokens are now locked to build community trust</p>
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
