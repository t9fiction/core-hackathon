import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useReadContract } from 'wagmi';
import { parseEther, parseUnits, Address, formatUnits } from 'viem';
import { CHAINCRAFT_FACTORY_ABI, CHAINCRAFT_TOKEN_ABI } from '../../lib/contracts/abis';
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
    ethAmount: '',
    lockDuration: '30', // Default 30 days
    description: ''
  });
  
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [needsApproval, setNeedsApproval] = useState(false);

  const contractAddresses = getContractAddresses(chainId);
  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Read token balance of the user
  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress as Address,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address as Address],
    query: {
      enabled: !!tokenAddress && !!address && isConnected,
    },
  });

  // Check if token is currently locked
  const { data: isCurrentlyLocked } = useReadContract({
    address: contractAddresses?.CHAINCRAFT_FACTORY as Address,
    abi: CHAINCRAFT_FACTORY_ABI,
    functionName: 'isTokenCurrentlyLocked',
    args: [tokenAddress as Address],
    query: {
      enabled: !!tokenAddress && !!contractAddresses?.CHAINCRAFT_FACTORY,
    },
  });

  // Get existing lock info if any
  const { data: tokenLockInfo } = useReadContract({
    address: contractAddresses?.CHAINCRAFT_FACTORY as Address,
    abi: CHAINCRAFT_FACTORY_ABI,
    functionName: 'getTokenLock',
    args: [tokenAddress as Address],
    query: {
      enabled: !!tokenAddress && !!contractAddresses?.CHAINCRAFT_FACTORY,
    },
  });

  // Check current allowance for token locking
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress as Address,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'allowance',
    args: [address as Address, contractAddresses?.CHAINCRAFT_FACTORY as Address],
    query: {
      enabled: !!tokenAddress && !!address && !!contractAddresses?.CHAINCRAFT_FACTORY && isConnected,
    },
  });

  // Check if approval is needed
  useEffect(() => {
    if (formData.tokenAmount && currentAllowance !== undefined) {
      const requestedAmount = parseUnits(formData.tokenAmount, 18);
      const allowance = currentAllowance as bigint;
      setNeedsApproval(requestedAmount > allowance);
    } else {
      setNeedsApproval(false);
    }
  }, [formData.tokenAmount, currentAllowance]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const calculateLockDurationInSeconds = () => {
    const days = parseFloat(formData.lockDuration);
    return days * 24 * 60 * 60; // Convert days to seconds
  };

  // Handle token approval for locking
  const handleApproveTokens = async () => {
    if (!formData.tokenAmount || !tokenAddress) return;
    
    try {
      setIsApproving(true);
      setError(null);
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      
      await writeContract({
        address: tokenAddress as Address,
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: 'approve',
        args: [contractAddresses?.CHAINCRAFT_FACTORY as Address, tokenAmountWei],
      });

      // Wait for approval and refetch allowance
      setTimeout(() => {
        refetchAllowance();
        setIsApproving(false);
      }, 3000);

    } catch (error: any) {
      console.error('Error approving tokens:', error);
      setError(error?.message || error?.reason || 'Failed to approve tokens');
      setIsApproving(false);
    }
  };

  const addLiquidity = async () => {
    if (!tokenAddress) {
      setError('Token address is required');
      return;
    }

    if (!formData.tokenAmount || !formData.ethAmount || !formData.lockDuration) {
      setError('Please fill in all required fields');
      return;
    }

    const tokenAmount = parseFloat(formData.tokenAmount);
    const ethAmount = parseFloat(formData.ethAmount);
    const lockDuration = parseFloat(formData.lockDuration);

    if (tokenAmount <= 0) {
      setError('Token amount must be greater than 0');
      return;
    }

    if (ethAmount <= 0) {
      setError('ETH collateral amount must be greater than 0');
      return;
    }

    if (lockDuration < 1 || lockDuration > 365) {
      setError('Lock duration must be between 1 and 365 days');
      return;
    }

    // Check if token is already locked
    if (isCurrentlyLocked) {
      setError('This token is already locked');
      return;
    }

    // Check if requested amount exceeds available balance
    if (tokenBalance) {
      const availableBalance = parseFloat(formatUnits(tokenBalance as bigint, 18));
      if (tokenAmount > availableBalance) {
        setError(`Requested amount (${tokenAmount}) exceeds available balance (${availableBalance.toFixed(2)})`);
        return;
      }
    }

    setIsAdding(true);
    setError(null);

    try {
      const tokenAmountWei = parseUnits(formData.tokenAmount, 18);
      const lockDurationSeconds = calculateLockDurationInSeconds();

      console.log('Locking tokens:', {
        tokenAddress,
        tokenAmount: tokenAmountWei.toString(),
        lockDuration: lockDurationSeconds,
        description: formData.description || `Locked ${tokenAmount} ${tokenSymbol} for ${lockDuration} days`,
        contractAddress: contractAddresses?.CHAINCRAFT_FACTORY
      });

      // Use the lockTokens function from the factory contract
      writeContract({
        address: contractAddresses?.CHAINCRAFT_FACTORY as Address,
        abi: CHAINCRAFT_FACTORY_ABI,
        functionName: 'lockTokens',
        args: [
          tokenAddress,
          tokenAmountWei,
          BigInt(lockDurationSeconds),
          formData.description || `Locked ${tokenAmount} ${tokenSymbol} for ${lockDuration} days`
        ],
        value: parseEther(formData.ethAmount), // ETH collateral required for trust lock
      });

    } catch (error: any) {
      console.error('Error locking tokens:', error);
      setError(error?.message || error?.reason || 'Failed to lock tokens');
      setIsAdding(false);
    }
  };

  // Handle successful token locking
  useEffect(() => {
    if (isSuccess && hash) {
      if (onLiquidityAdded) {
        onLiquidityAdded(hash);
      }
      // Reset form and refresh balance
      setFormData({ tokenAmount: '', ethAmount: '', lockDuration: '30', description: '' });
      refetchBalance();
      setIsAdding(false);
    }
  }, [isSuccess, hash, onLiquidityAdded, refetchBalance]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      setIsAdding(false);
    }
  }, [writeError]);

  const lockDurationSeconds = calculateLockDurationInSeconds();

  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
        🔒 Lock Tokens for Trust Building
      </h4>

      {/* Current Lock Status */}
      {tokenLockInfo && (tokenLockInfo as any).isActive && (
        <div className="p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/50 rounded-lg mb-4">
          <div className="text-yellow-200 text-sm">
            <div className="font-medium mb-2 text-yellow-300">🔒 Token Currently Locked:</div>
            <ul className="text-xs space-y-1">
              <li>Amount: {formatUnits((tokenLockInfo as any).tokenAmount, 18)} {tokenSymbol}</li>
              <li>Lock Duration: {Math.floor(Number((tokenLockInfo as any).lockDuration) / (24 * 60 * 60))} days</li>
              <li>Description: {(tokenLockInfo as any).description}</li>
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Available Balance Display */}
        {tokenBalance && (
          <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <div className="text-blue-200 text-sm">
              <div className="font-medium text-blue-300 mb-1">📊 Available for Locking:</div>
              <div className="text-lg font-semibold">
                {parseFloat(formatUnits(tokenBalance as bigint, 18)).toFixed(2)} {tokenSymbol}
              </div>
              <div className="text-xs text-blue-300 mt-1">
                (Your current token balance)
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
            max={tokenBalance ? formatUnits(tokenBalance as bigint, 18) : undefined}
            className="w-full p-3 rounded bg-gray-600 border border-gray-500 text-white focus:border-blue-500 focus:outline-none"
          />
          {tokenBalance && (
            <div className="text-xs text-gray-400 mt-1">
              Max: {parseFloat(formatUnits(tokenBalance as bigint, 18)).toFixed(2)} {tokenSymbol}
            </div>
          )}
        </div>

        <div>
          <label className="block text-gray-300 text-sm mb-1">
            ETH Collateral Amount
          </label>
          <input
            type="number"
            step="0.001"
            value={formData.ethAmount}
            onChange={(e) => handleInputChange('ethAmount', e.target.value)}
            placeholder="0.1"
            className="w-full p-3 rounded bg-gray-600 border border-gray-500 text-white focus:border-blue-500 focus:outline-none"
          />
          <div className="text-xs text-gray-400 mt-1">
            ETH required as collateral for the lock (shows commitment)
          </div>
        </div>

        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Lock Duration (Days)
          </label>
          <input
            type="number"
            value={formData.lockDuration}
            onChange={(e) => handleInputChange('lockDuration', e.target.value)}
            placeholder="7"
            min="1"
            max="365"
            className="w-full p-3 rounded bg-gray-600 border border-gray-500 text-white focus:border-blue-500 focus:outline-none"
          />
          <div className="text-xs text-gray-400 mt-1">
            Min: 1 day, Max: 365 days
          </div>
        </div>

        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Description (Optional)
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Trust-building lock for community"
            maxLength={100}
            className="w-full p-3 rounded bg-gray-600 border border-gray-500 text-white focus:border-blue-500 focus:outline-none"
          />
          <div className="text-xs text-gray-400 mt-1">
            Optional description for the lock (max 100 characters)
          </div>
        </div>

        {/* Lock Summary */}
        {formData.tokenAmount && formData.lockDuration && (
          <div className="p-3 bg-gray-600 rounded">
            <div className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-300">Lock Amount:</span>
                <span className="text-white">{formData.tokenAmount} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-300">ETH Collateral:</span>
                <span className="text-yellow-400">{formData.ethAmount} ETH</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-300">Lock Duration:</span>
                <span className="text-white">{formData.lockDuration} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Unlock Time:</span>
                <span className="text-white">{new Date(Date.now() + lockDurationSeconds * 1000).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Important Notice */}
        <div className="p-4 bg-gradient-to-r from-orange-900/30 to-yellow-900/30 border border-orange-500/50 rounded-lg">
          <div className="text-orange-200 text-sm">
            <div className="font-medium mb-2 text-orange-300">🛡️ Token Locking Mechanism:</div>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>Locks tokens in the factory contract for trust building</strong></li>
              <li>Tokens will be locked for the specified duration</li>
              <li>Builds community trust by preventing token dumps</li>
              <li>Locked tokens cannot be accessed until the lock period expires</li>
              <li>Only the token creator can unlock after the period expires</li>
              <li>Lock information is publicly visible on-chain</li>
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

        {/* Approval Status Display */}
        {formData.tokenAmount && currentAllowance !== undefined && (
          <div className="p-3 bg-gray-600 rounded mb-3">
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Current Allowance:</span>
                <span className="text-white">{parseFloat(formatUnits(currentAllowance as bigint, 18)).toFixed(2)} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Requested Amount:</span>
                <span className="text-white">{formData.tokenAmount} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Approval Status:</span>
                <span className={`${needsApproval ? 'text-orange-400' : 'text-green-400'}`}>
                  {needsApproval ? '⚠️ Approval Required' : '✅ Approved'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Approve/Lock Button Flow */}
        {needsApproval ? (
          <button
            onClick={handleApproveTokens}
            disabled={
              !isConnected ||
              !tokenAddress ||
              !formData.tokenAmount ||
              !formData.ethAmount ||
              !formData.lockDuration ||
              isApproving ||
              (isCurrentlyLocked === true)
            }
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white py-3 px-4 rounded font-medium transition-colors mb-2"
          >
            {isApproving ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Approving Tokens...
              </span>
            ) : (
              `📝 Step 1: Approve ${formData.tokenAmount} ${tokenSymbol}`
            )}
          </button>
        ) : (
          <button
            onClick={addLiquidity}
            disabled={
              !isConnected ||
              !tokenAddress ||
              !formData.tokenAmount ||
              !formData.ethAmount ||
              !formData.lockDuration ||
              isAdding ||
              isPending ||
              isConfirming ||
              (isCurrentlyLocked === true)
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
              isCurrentlyLocked ? 'Token Already Locked' : '🔐 Step 2: Lock Tokens'
            )}
          </button>
        )}

        {isSuccess && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
            <p className="text-green-300 text-sm">✅ Tokens locked successfully!</p>
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
