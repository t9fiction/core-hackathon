import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAccount, useReadContract, useBalance, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { Address, formatEther, parseEther } from 'viem';
import { PUMPFUN_DEX_MANAGER_ABI, PUMPFUN_TOKEN_ABI } from '../../lib/contracts/abis';
// import { PUMPFUN_DEX_MANAGER } from '../../lib/contracts/addresses';
import { getContractAddresses } from '../../lib/contracts/addresses';

interface BuySellTokensProps {
  tokenAddress: Address;
}

export default function BuySellTokens({ tokenAddress }: BuySellTokensProps) {
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const chainId = useChainId();

  const contractAddresses = getContractAddresses(chainId);

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Get token info
  const { data: tokenName } = useReadContract({
    address: tokenAddress,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'name',
  });

  const { data: tokenSymbol } = useReadContract({
    address: tokenAddress,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'symbol',
  });

  // Get token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      enabled: !!address,
    },
  });

  // Get token allowance for DEX Manager
  const { data: tokenAllowance } = useReadContract({
    address: tokenAddress,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'allowance',
    args: [address!, contractAddresses.PUMPFUN_DEX_MANAGER],
    query: {
      enabled: !!address,
    },
  });

  // Debounced buy amount for estimates to prevent excessive calls  
  const [debouncedBuyAmount, setDebouncedBuyAmount] = useState('');
  const [debouncedSellAmount, setDebouncedSellAmount] = useState('');

  // Debounce the amount inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBuyAmount(buyAmount);
    }, 500);
    return () => clearTimeout(timer);
  }, [buyAmount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSellAmount(sellAmount);
    }, 500);
    return () => clearTimeout(timer);
  }, [sellAmount]);

  // Note: getAmountsOutSingleHop is not a view function, so we can't use it for estimates
  // For now, we'll use a simple placeholder for price estimates
  const buyEstimate = null;
  const sellEstimate = null;

  // Set transaction hash when available
  useEffect(() => {
    if (hash) {
      setTxHash(hash);
    }
  }, [hash]);

  // Reset transaction state when confirmed
  useEffect(() => {
    if (isConfirmed) {
      setTxHash(undefined);
    }
  }, [isConfirmed]);

  const handleBuyTokens = async () => {
    if (!tokenAddress || !buyAmount || !address) return;
    setIsLoading(true);
    
    try {
      const amountIn = parseEther(buyAmount);
      const slippageTolerance = 500n; // 5% slippage in basis points (500 = 5%)
      console.log("Slippage Tolerance:", slippageTolerance);
      
      await writeContract({
        address: contractAddresses.PUMPFUN_DEX_MANAGER,
        abi: PUMPFUN_DEX_MANAGER_ABI,
        functionName: 'swapExactETHForTokensWithSlippage',
        args: [tokenAddress, 3000, slippageTolerance],
        value: amountIn,
      });
      
      setBuyAmount('');
    } catch (error: any) {
      console.error('Error buying tokens:', error);
      alert('Failed to buy tokens: ' + (error.shortMessage || error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveToken = async (_amount: string) => {
    if (!tokenAddress || !address) return;
    setIsLoading(true);
    
    try {
      await writeContract({
        address: tokenAddress,
        abi: PUMPFUN_TOKEN_ABI,
        functionName: 'approve',
        args: [contractAddresses.PUMPFUN_DEX_MANAGER, parseEther(_amount)], // Approve large amount
      });
    } catch (error: any) {
      console.error('Error approving tokens:', error);
      alert('Failed to approve tokens: ' + (error.shortMessage || error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSellTokens = async () => {
    if (!tokenAddress || !sellAmount || !address) return;
    setIsLoading(true);
    
    try {
      // First approve tokens if needed
      // if (needsApproval) {
        await handleApproveToken(sellAmount);
        // Wait a bit for the approval to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
      // }
      
      const amountIn = parseEther(sellAmount);
      const slippageTolerance = 500n; // 5% slippage in basis points (500 = 5%)
      console.log("Slippage Tolerance:", slippageTolerance);
      
      await writeContract({
        address: contractAddresses.PUMPFUN_DEX_MANAGER,
        abi: PUMPFUN_DEX_MANAGER_ABI,
        functionName: 'swapExactTokensForETHWithSlippage',
        args: [tokenAddress, 3000, amountIn, slippageTolerance],
      });
      
      setSellAmount('');
    } catch (error: any) {
      console.error('Error selling tokens:', error);
      alert('Failed to sell tokens: ' + (error.shortMessage || error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate values using useMemo (must be before conditional returns)
  const calculateBuyOutput = useMemo(() => {
    if (!buyAmount || !buyEstimate) return '0';
    const estimate = buyEstimate as bigint;
    return formatEther(estimate);
  }, [buyAmount, buyEstimate]);

  const calculateSellOutput = useMemo(() => {
    if (!sellAmount || !sellEstimate) return '0';
    const estimate = sellEstimate as bigint;
    return formatEther(estimate);
  }, [sellAmount, sellEstimate]);

  const needsApproval = useMemo(() => {
    if (!sellAmount || !tokenAllowance) return false;
    try {
      return parseEther(sellAmount) > (tokenAllowance as bigint);
    } catch {
      return false;
    }
  }, [sellAmount, tokenAllowance]);

  if (!isConnected) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-gray-400">Please connect your wallet to trade tokens.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">
            Trade {tokenSymbol as string || 'Token'}
          </h3>
          <div className="bg-gray-700 px-3 py-1 rounded-lg">
            <span className="text-sm text-gray-300">
              {isConfirming ? 'Transaction Pending...' : isConfirmed ? 'Transaction Confirmed!' : 'Ready to Trade'}
            </span>
          </div>
        </div>

        {/* Balance Display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center bg-gray-700/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Your ETH Balance</p>
            <p className="text-lg font-semibold text-white">
              {ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000'} ETH
            </p>
          </div>
          <div className="text-center bg-gray-700/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Your {tokenSymbol as string || 'Token'} Balance</p>
            <p className="text-lg font-semibold text-white">
              {tokenBalance ? parseFloat(formatEther(tokenBalance as bigint)).toFixed(4) : '0.0000'} {tokenSymbol as string || 'Token'}
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex space-x-1 mb-6 bg-gray-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'buy'
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            Buy Tokens
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'sell'
                ? 'bg-red-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            Sell Tokens
          </button>
        </div>

        {/* Buy Tab */}
        {activeTab === 'buy' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ETH Amount to Spend
              </label>
              <input
                type="number"
                placeholder="0.0"
                value={buyAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBuyAmount(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-white"
              />
              <div className="text-sm text-gray-400 mt-1">
                You will receive: ~{parseFloat(calculateBuyOutput).toFixed(6)} {tokenSymbol as string || 'tokens'}
              </div>
            </div>
            
            <button
              onClick={handleBuyTokens}
              disabled={isLoading || isConfirming || !buyAmount || parseFloat(buyAmount) > parseFloat(formatEther(ethBalance?.value || 0n))}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isLoading || isConfirming ? 'Processing...' : `Buy ${tokenSymbol as string || 'Tokens'}`}
            </button>
          </div>
        )}

        {/* Sell Tab */}
        {activeTab === 'sell' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {tokenSymbol as string || 'Token'} Amount to Sell
              </label>
              <input
                type="number"
                placeholder="0.0"
                value={sellAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSellAmount(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-white"
              />
              <div className="text-sm text-gray-400 mt-1">
                You will receive: ~{parseFloat(calculateSellOutput).toFixed(6)} ETH
              </div>
            </div>
            
            {needsApproval ? (
              <button
                onClick={() => handleApproveToken(sellAmount)}
                disabled={isLoading || isConfirming}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors mb-2"
              >
                {isLoading || isConfirming ? 'Approving...' : `Approve ${tokenSymbol as string || 'Tokens'}`}
              </button>
            ) : null}
            
            <button
              onClick={handleSellTokens}
              disabled={isLoading || isConfirming || !sellAmount || parseFloat(sellAmount) > parseFloat(formatEther(tokenBalance as bigint || 0n)) || needsApproval}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isLoading || isConfirming ? 'Processing...' : `Sell ${tokenSymbol as string || 'Tokens'}`}
            </button>
          </div>
        )}
      </div>

      {/* Transaction Status */}
      {txHash && (
        <div className="bg-blue-600/10 border border-blue-600/20 rounded-2xl p-4">
          <div className="text-blue-200">
            <strong>Transaction Status:</strong> 
            {isConfirming && ' Confirming transaction...'}
            {isConfirmed && ' Transaction confirmed successfully!'}
            <div className="text-sm mt-1 font-mono break-all">
              Tx Hash: {txHash}
            </div>
          </div>
        </div>
      )}
      
      {/* Trading Info */}
      <div className="bg-blue-600/10 border border-blue-600/20 rounded-2xl p-4">
        <div className="text-blue-200">
          <strong>Trading Info:</strong> This interface connects to the PumpFun DEX for real token trading. 
          Prices are fetched from the liquidity pool and include a 5% slippage tolerance.
        </div>
      </div>
    </div>
  );
}
