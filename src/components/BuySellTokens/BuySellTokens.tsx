import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { Address, formatEther, parseEther } from 'viem';
import { CHAINCRAFT_DEX_MANAGER_ABI, CHAINCRAFT_TOKEN_ABI } from '../../lib/contracts/abis';
// import { CHAINCRAFT_DEX_MANAGER } from '../../lib/contracts/addresses';
import { getContractAddresses } from '../../lib/contracts/addresses';
import { showSuccessAlert, showErrorAlert } from '../../lib/swal-config';
import { useSmartContractRead, useIsFallbackMode } from '../../lib/hooks/useSmartContract';
import { useTokenApproval } from '../../lib/hooks/useTokenApproval';

interface BuySellTokensProps {
  tokenAddress: Address;
  tokenName?: string;
  tokenSymbol?: string;
  defaultTab?: 'buy' | 'sell';
  onTabChange?: (tab: string) => void;
  embedded?: boolean;
  onTransactionComplete?: () => void;
}

export const BuySellTokens = ({ 
  tokenAddress, 
  tokenName: propTokenName, 
  tokenSymbol: propTokenSymbol,
  defaultTab = 'buy',
  onTabChange,
  embedded = false,
  onTransactionComplete
}: BuySellTokensProps) => {
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>(defaultTab);
  
  // Update activeTab when defaultTab prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const isFallbackMode = useIsFallbackMode();
  
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

  // Get token info from contract
  const { data: contractTokenName } = useSmartContractRead({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'name',
  });

  const { data: contractTokenSymbol } = useSmartContractRead({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'symbol',
  });

  // Use props if provided, otherwise use contract data
  const tokenName = propTokenName || (contractTokenName as string);
  const tokenSymbol = propTokenSymbol || (contractTokenSymbol as string);

  // Get token balance
  const { data: tokenBalance } = useSmartContractRead({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address!],
    enabled: !!address,
  });

  // Universal approval hook for selling tokens
  const {
    needsApproval,
    approve: approveTokens,
    approvalPending,
    approvalSuccess,
    approvalError,
    spenderName,
  } = useTokenApproval({
    tokenAddress,
    spenderAddress: contractAddresses.CHAINCRAFT_DEX_MANAGER as Address,
    userAddress: address,
    amount: sellAmount || '0',
    decimals: 18,
    enableMaxApproval: true, // Better UX - approve max amount
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

  // Get token price for estimates (temporary fallback)
  const { data: tokenPriceData } = useSmartContractRead({
    address: contractAddresses.CHAINCRAFT_DEX_MANAGER,
    abi: CHAINCRAFT_DEX_MANAGER_ABI,
    functionName: 'getTokenPrice',
    args: [tokenAddress],
    enabled: true,
  });

  // Note: Using getTokenPrice as fallback since getAmountsOutSingleHop is not a view function
  // This will be replaced with proper quoter implementation later

  // Set transaction hash when available
  useEffect(() => {
    if (hash) {
      setTxHash(hash);
    }
  }, [hash]);

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed && txHash) {
      showSuccessAlert(
        'Transaction Successful!',
        `Your transaction has been confirmed on the blockchain.\nTx Hash: ${txHash.slice(0, 10)}...`,
        5000
      );
      setTxHash(undefined);
      
      // Call completion callback if provided
      if (onTransactionComplete) {
        onTransactionComplete();
      }
    }
  }, [isConfirmed, txHash, onTransactionComplete]);

  const handleBuyTokens = async () => {
    if (!tokenAddress || !buyAmount || !address) return;
    setIsLoading(true);
    
    try {
        const amountIn = parseEther(buyAmount);
        // Generate route data (empty for now, RouteProcessor7 can handle simple swaps)
        const routeData = '0x' as `0x${string}`;
        
        await writeContract({
          address: contractAddresses.CHAINCRAFT_DEX_MANAGER,
          abi: CHAINCRAFT_DEX_MANAGER_ABI,
          functionName: 'swapETHForTokens',
          args: [tokenAddress, routeData],
          value: amountIn,
        });
      
      setBuyAmount('');
    } catch (error: any) {
      console.error('Error buying tokens:', error);
      showErrorAlert(
        'Transaction Failed',
        error.shortMessage || error.message || 'Unknown error occurred while buying tokens'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSellTokens = async () => {
    if (!tokenAddress || !sellAmount || !address) return;
    setIsLoading(true);
    
    try {
      // Check if approval is needed first
      if (needsApproval) {
        await approveTokens(); // Use universal approval
        return; // Wait for approval success
      }
      
      // If approval complete, proceed with selling
      const amountIn = parseEther(sellAmount);
      // Generate route data (empty for now, RouteProcessor7 can handle simple swaps)
      const routeData = '0x' as `0x${string}`;
      
      await writeContract({
        address: contractAddresses.CHAINCRAFT_DEX_MANAGER,
        abi: CHAINCRAFT_DEX_MANAGER_ABI,
        functionName: 'swapTokensForETH',
        args: [tokenAddress, amountIn, routeData],
      });
    
      setSellAmount('');
    } catch (error: any) {
      console.error('Error selling tokens:', error);
      showErrorAlert(
        'Transaction Failed',
        error.shortMessage || error.message || 'Unknown error occurred while selling tokens'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Auto-proceed to sell after approval success
  useEffect(() => {
    if (approvalSuccess && activeTab === 'sell' && sellAmount) {
      // Re-trigger sell after approval
      setTimeout(() => handleSellTokens(), 1000);
    }
  }, [approvalSuccess, activeTab, sellAmount]);

  // Calculate values using useMemo (must be before conditional returns)
  const calculateBuyOutput = useMemo(() => {
    if (!debouncedBuyAmount || !tokenPriceData || isNaN(Number(debouncedBuyAmount))) return '0';
    if (Array.isArray(tokenPriceData) && tokenPriceData.length > 0) {
      const price = tokenPriceData[0] as bigint; // price is first element of tuple
      const ethAmount = parseEther(debouncedBuyAmount);
      // Simple calculation: ethAmount / price (need to handle decimals properly)
      const estimated = (ethAmount * parseEther('1')) / price;
      return formatEther(estimated);
    }
    return '0';
  }, [debouncedBuyAmount, tokenPriceData]);

  const calculateSellOutput = useMemo(() => {
    if (!debouncedSellAmount || !tokenPriceData || isNaN(Number(debouncedSellAmount))) return '0';
    if (Array.isArray(tokenPriceData) && tokenPriceData.length > 0) {
      const price = tokenPriceData[0] as bigint; // price is first element of tuple
      const tokenAmount = parseEther(debouncedSellAmount);
      // Simple calculation: tokenAmount * price
      const estimated = (tokenAmount * price) / parseEther('1');
      return formatEther(estimated);
    }
    return '0';
  }, [debouncedSellAmount, tokenPriceData]);

  // Processing state combining local loading and approval states
  const isProcessingOverall = isLoading || approvalPending || isConfirming;
  
  // Status message for sell transactions
  const sellStatusMessage = approvalPending ? `Approving tokens with ${spenderName}...` : 
                           approvalError ? `Approval failed: ${approvalError}` :
                           isLoading ? 'Processing transaction...' : '';

  if (!isConnected) {
    return (
      <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-slate-400 mb-4">Please connect your wallet to trade tokens.</p>
          <div className="text-xs text-amber-300 bg-amber-400/10 rounded-lg p-3 border border-amber-400/20">
            <p className="mb-1">📊 You can view token information without connecting a wallet.</p>
            <p>🔒 Connect your wallet to enable trading functionality.</p>
          </div>
        </div>
      </div>
    );
  }

  const containerClasses = embedded 
    ? "space-y-4" 
    : "space-y-6";
    
  const cardClasses = embedded 
    ? "bg-transparent p-6" 
    : "bg-slate-700 rounded-lg p-6 border border-slate-600";

  return (
    <div className={containerClasses}>
      <div className={cardClasses}>
        {!embedded && (
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">
              Trade {tokenSymbol as string || 'Token'}
            </h3>
            <div className="bg-slate-600 px-3 py-1 rounded-lg">
              <span className="text-sm text-slate-300">
                {isConfirming ? 'Transaction Pending...' : isConfirmed ? 'Transaction Confirmed!' : 'Ready to Trade'}
              </span>
            </div>
          </div>
        )}

        {/* Balance Display */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="text-center bg-slate-800 rounded-lg p-3">
            <p className="text-sm text-slate-400 mb-1">Your ETH Balance</p>
            <p className="text-base font-medium text-white">
              {ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000'} ETH
            </p>
          </div>
          <div className="text-center bg-slate-800 rounded-lg p-3">
            <p className="text-sm text-slate-400 mb-1">Your {tokenSymbol as string || 'Token'} Balance</p>
            <p className="text-base font-medium text-white">
              {tokenBalance ? parseFloat(formatEther(tokenBalance as bigint)).toFixed(4) : '0.0000'} {tokenSymbol as string || 'Token'}
            </p>
          </div>
        </div>

        {/* Tab Buttons - Hidden in embedded mode */}
        {!embedded && (
          <div className="flex space-x-1 mb-6 bg-slate-700 p-1 rounded-lg">
            <button
              onClick={() => {
                setActiveTab('buy');
                onTabChange?.('buy');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'buy'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            >
              Buy Tokens
            </button>
            <button
              onClick={() => {
                setActiveTab('sell');
                onTabChange?.('sell');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sell'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            >
              Sell Tokens
            </button>
          </div>
        )}

        {/* Buy Tab */}
        {activeTab === 'buy' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                ETH Amount to Spend
              </label>
              <input
                type="number"
                placeholder="0.0"
                value={buyAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBuyAmount(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-400"
              />
              <div className="text-sm text-slate-400 mt-1">
                You will receive: ~{parseFloat(calculateBuyOutput).toFixed(6)} {tokenSymbol as string || 'tokens'}
              </div>
            </div>
            
            <button
              onClick={handleBuyTokens}
              disabled={isLoading || isConfirming || !buyAmount || parseFloat(buyAmount) > parseFloat(formatEther(ethBalance?.value || 0n))}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isLoading || isConfirming ? 'Processing...' : `Buy ${tokenSymbol as string || 'Tokens'}`}
            </button>
          </div>
        )}

        {/* Sell Tab */}
        {activeTab === 'sell' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {tokenSymbol as string || 'Token'} Amount to Sell
              </label>
              <input
                type="number"
                placeholder="0.0"
                value={sellAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSellAmount(e.target.value)}
                disabled={isProcessingOverall}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-white placeholder-slate-400 disabled:opacity-50"
              />
              <div className="text-sm text-slate-400 mt-1">
                You will receive: ~{parseFloat(calculateSellOutput).toFixed(6)} ETH
              </div>
            </div>
            
            {/* Universal approval status */}
            {sellStatusMessage && (
              <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  <p className="text-blue-300 text-sm">{sellStatusMessage}</p>
                </div>
              </div>
            )}
            
            {/* Approval error display */}
            {approvalError && (
              <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                <p className="text-red-300 text-sm">❌ {approvalError}</p>
              </div>
            )}
            
            <button
              onClick={handleSellTokens}
              disabled={isProcessingOverall || !sellAmount || parseFloat(sellAmount) > parseFloat(formatEther(tokenBalance as bigint || 0n))}
              className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isProcessingOverall ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {approvalPending ? 'Approving...' : 'Processing...'}
                </span>
              ) : (
                `Sell ${tokenSymbol as string || 'Tokens'}`
              )}
            </button>
            
            {/* Help text */}
            <div className="text-xs text-slate-400 text-center">
              {needsApproval ? 
                'Token approval will be handled automatically when you sell.' :
                'Ready to sell - no approval needed.'
              }
            </div>
          </div>
        )}
      </div>

      {/* Transaction Status - Hidden in embedded mode */}
      {!embedded && txHash && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="text-blue-300">
            <strong>Transaction Status:</strong> 
            {isConfirming && ' Confirming transaction...'}
            {isConfirmed && ' Transaction confirmed successfully!'}
            <div className="text-sm mt-1 font-mono break-all">
              Tx Hash: {txHash}
            </div>
          </div>
        </div>
      )}
      
      {/* Trading Info - Hidden in embedded mode */}
      {!embedded && (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-4">
          <div className="text-slate-300">
            <strong>Trading Info:</strong> This interface connects to the ChainCraft DEX for real token trading. 
            Prices are fetched from the liquidity pool and include a 5% slippage tolerance.
          </div>
        </div>
      )}
    </div>
  );
}

export default BuySellTokens;
