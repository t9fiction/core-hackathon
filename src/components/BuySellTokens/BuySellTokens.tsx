import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useChainId, useReadContract } from 'wagmi';
import { Address, formatEther, parseEther, parseUnits } from 'viem';
import { CHAINCRAFT_TOKEN_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';
import { showSuccessAlert, showErrorAlert } from '../../lib/swal-config';
import { useTokenApproval } from '../../lib/hooks/useTokenApproval';

// SushiSwap V2 Router ABI (essential functions)
const SUSHISWAP_V2_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactETHForTokens",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForETH",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// SushiSwap V2 Factory ABI (for pair checking)
const SUSHISWAP_V2_FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
    ],
    name: "getPair",
    outputs: [{ internalType: "address", name: "pair", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// SushiSwap V2 addresses on Core DAO - Same as ImprovedPoolManager
const SUSHISWAP_V2_ADDRESSES = {
  1116: { // Core DAO Mainnet
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763",
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",
  },
  1114: { // Core DAO Testnet2
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763",
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",
  }
};

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
  
  const chainId = useChainId();

  const contractAddresses = getContractAddresses(chainId);
  const sushiV2Addresses = SUSHISWAP_V2_ADDRESSES[chainId as keyof typeof SUSHISWAP_V2_ADDRESSES];

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Get token info from contract
  const { data: contractTokenName } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'name',
    query: {
      enabled: !!tokenAddress,
    },
  });

  const { data: contractTokenSymbol } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!tokenAddress,
    },
  });

  // Use props if provided, otherwise use contract data
  const tokenName = propTokenName || (contractTokenName as string);
  const tokenSymbol = propTokenSymbol || (contractTokenSymbol as string);

  // Get token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      enabled: !!address,
    },
  });

  // Check if pair exists on SushiSwap
  const { data: existingPair } = useReadContract({
    address: sushiV2Addresses?.factory as Address,
    abi: SUSHISWAP_V2_FACTORY_ABI,
    functionName: "getPair",
    args: [tokenAddress, contractAddresses.WETH],
    query: {
      enabled: !!(tokenAddress && contractAddresses.WETH && sushiV2Addresses?.factory),
    },
  });

  const pairExists = existingPair && existingPair !== "0x0000000000000000000000000000000000000000";

  // Universal approval hook for selling tokens (SushiSwap Router)
  const {
    needsApproval,
    approve: approveTokens,
    approvalPending,
    approvalSuccess,
    approvalError,
    spenderName,
  } = useTokenApproval({
    tokenAddress,
    spenderAddress: sushiV2Addresses?.router as Address,
    userAddress: address,
    amount: sellAmount || '0', // Use actual sell amount for approval check
    decimals: 18,
    enableMaxApproval: false, // Approve only exact amount being sold
  });

  // Debounced buy amount for estimates to prevent excessive calls  
  const [debouncedBuyAmount, setDebouncedBuyAmount] = useState('');
  const [debouncedSellAmount, setDebouncedSellAmount] = useState('');

  // Debounce the amount inputs with dependency on pairExists to prevent excessive calls
  useEffect(() => {
    if (!pairExists) {
      setDebouncedBuyAmount('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedBuyAmount(buyAmount);
    }, 500);
    return () => clearTimeout(timer);
  }, [buyAmount, pairExists]);

  useEffect(() => {
    if (!pairExists) {
      setDebouncedSellAmount('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSellAmount(sellAmount);
    }, 500);
    return () => clearTimeout(timer);
  }, [sellAmount, pairExists]);

  // Get buy quote from SushiSwap
  const { data: buyQuote, error: buyQuoteError } = useReadContract({
    address: sushiV2Addresses?.router as Address,
    abi: SUSHISWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [
      debouncedBuyAmount && parseFloat(debouncedBuyAmount) > 0 ? parseEther(debouncedBuyAmount) : parseEther('0.001'),
      [contractAddresses.WETH, tokenAddress]
    ],
    query: {
      enabled: !!(pairExists && sushiV2Addresses?.router && contractAddresses.WETH && tokenAddress),
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

  // Get sell quote from SushiSwap  
  const { data: sellQuote, error: sellQuoteError } = useReadContract({
    address: sushiV2Addresses?.router as Address,
    abi: SUSHISWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [
      debouncedSellAmount && parseFloat(debouncedSellAmount) > 0 ? parseUnits(debouncedSellAmount, 18) : parseUnits('1', 18),
      [tokenAddress, contractAddresses.WETH]
    ],
    query: {
      enabled: !!(pairExists && sushiV2Addresses?.router && contractAddresses.WETH && tokenAddress),
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

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
    if (!tokenAddress || !buyAmount || !address || !sushiV2Addresses) return;
    
    if (!pairExists) {
      showErrorAlert(
        'Pool Not Available',
        'No SushiSwap pool exists for this token. Please create a liquidity pool first.'
      );
      return;
    }
    
    setIsLoading(true);
    
    try {
      const amountIn = parseEther(buyAmount);
      const path = [contractAddresses.WETH, tokenAddress];
      
      // Calculate minimum amount out with 10% slippage for safety
      let minAmountOut = 1n; // Start with minimal amount
      
      if (buyQuote && Array.isArray(buyQuote) && buyQuote.length > 1) {
        // Scale the quote to the actual input amount
        const quoteInput = parseEther('0.001');
        const quoteOutput = buyQuote[1] as bigint;
        const scaledOutput = (quoteOutput * amountIn) / quoteInput;
        minAmountOut = (scaledOutput * 90n) / 100n; // 10% slippage
      }
      
      // Deadline: 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      
      console.log('🟢 Attempting to buy tokens with SushiSwap:', {
        chainId,
        amountIn: amountIn.toString(),
        amountInFormatted: buyAmount + ' CORE',
        minAmountOut: minAmountOut.toString(),
        minAmountOutFormatted: formatEther(minAmountOut) + ' ' + tokenSymbol,
        path,
        pathFormatted: ['WCORE', tokenSymbol],
        deadline: deadline.toString(),
        router: sushiV2Addresses.router,
        factory: sushiV2Addresses.factory,
        pairExists,
        buyQuoteAvailable: !!(buyQuote && Array.isArray(buyQuote) && buyQuote.length > 1),
        userAddress: address,
        timestamp: new Date().toISOString()
      });
      
      await writeContract({
        address: sushiV2Addresses.router as Address,
        abi: SUSHISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactETHForTokens',
        args: [minAmountOut, path, address, deadline],
        value: amountIn,
      });
      
      setBuyAmount('');
    } catch (error: any) {
      console.error('🔴 Error buying tokens:', {
        error,
        chainId,
        tokenAddress,
        buyAmount,
        pairExists,
        sushiV2Addresses,
        contractAddresses,
        timestamp: new Date().toISOString()
      });
      showErrorAlert(
        'Transaction Failed',
        `Buy transaction failed: ${error.shortMessage || error.message || 'Unknown error'}\n\nCheck console for detailed error information.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const [isApprovingForSell, setIsApprovingForSell] = useState(false);

  const handleSellTokens = async () => {
    if (!tokenAddress || !sellAmount || !address || !sushiV2Addresses) return;
    
    if (!pairExists) {
      showErrorAlert(
        'Pool Not Available',
        'No SushiSwap pool exists for this token. Please create a liquidity pool first.'
      );
      return;
    }
    
    setIsLoading(true);
    
    try {
      // ALWAYS approve tokens before selling - force approval
      if (!isApprovingForSell) {
        console.log('🟡 Forcing approval before selling...', {
          tokenAddress,
          spenderAddress: sushiV2Addresses.router,
          sellAmount,
          contractAddresses: {
            WETH: contractAddresses.WETH,
            router: sushiV2Addresses.router,
            factory: sushiV2Addresses.factory
          },
          timestamp: new Date().toISOString()
        });
        setIsApprovingForSell(true);
        await approveTokens(); // Always approve before selling
        return; // Wait for approval success
      }
      
      // Reset approval flag and proceed with selling
      setIsApprovingForSell(false);
      
      // If approval complete, proceed with selling
      const amountIn = parseUnits(sellAmount, 18);
      const path = [tokenAddress, contractAddresses.WETH];
      
      // Calculate minimum amount out with 20% slippage for safety
      let minAmountOut = 1n; // Start with minimal amount
      
      if (sellQuote && Array.isArray(sellQuote) && sellQuote.length > 1) {
        // Use the quote directly since it's already calculated for the sell amount
        const quoteOutput = sellQuote[1] as bigint;
        minAmountOut = (quoteOutput * 80n) / 100n; // 20% slippage for more tolerance
        
        console.log('🔍 Sell slippage calculation:', {
          quoteOutput: quoteOutput.toString(),
          minAmountOut: minAmountOut.toString(),
          slippagePercent: '20%'
        });
      }
      
      // Deadline: 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      
      console.log('🟢 Attempting to sell tokens with SushiSwap:', {
        chainId,
        amountIn: amountIn.toString(),
        amountInFormatted: sellAmount + ' ' + tokenSymbol,
        minAmountOut: minAmountOut.toString(),
        minAmountOutFormatted: formatEther(minAmountOut) + ' CORE',
        path,
        pathFormatted: [tokenSymbol, 'WCORE'],
        deadline: deadline.toString(),
        router: sushiV2Addresses.router,
        factory: sushiV2Addresses.factory,
        pairExists,
        sellQuoteAvailable: !!(sellQuote && Array.isArray(sellQuote) && sellQuote.length > 1),
        userAddress: address,
        gas: '300000', // Add explicit gas limit
        timestamp: new Date().toISOString()
      });
      
      await writeContract({
        address: sushiV2Addresses.router as Address,
        abi: SUSHISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [amountIn, minAmountOut, path, address, deadline],
        gas: 300000n, // Add explicit gas limit for the transaction
      });
    
      setSellAmount('');
    } catch (error: any) {
      console.error('🔴 Error selling tokens:', {
        error,
        chainId,
        tokenAddress,
        sellAmount,
        pairExists,
        sushiV2Addresses,
        contractAddresses,
        timestamp: new Date().toISOString()
      });
      showErrorAlert(
        'Transaction Failed',
        `Sell transaction failed: ${error.shortMessage || error.message || 'Unknown error'}\n\nCheck console for detailed error information.`
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

  // Calculate values using useMemo with SushiSwap quotes
  const calculateBuyOutput = useMemo(() => {
    if (!debouncedBuyAmount || !buyQuote || isNaN(Number(debouncedBuyAmount)) || !pairExists || parseFloat(debouncedBuyAmount) <= 0) {
      return '0';
    }
    
    try {
      if (Array.isArray(buyQuote) && buyQuote.length > 1) {
        const inputAmount = parseEther(debouncedBuyAmount);
        const outputAmount = buyQuote[1] as bigint;
        
        // Scale the output based on actual input vs quote input
        const quoteInput = parseEther('0.001');
        const scaledOutput = (outputAmount * inputAmount) / quoteInput;
        
        return formatEther(scaledOutput);
      }
    } catch (error) {
      console.error('Error calculating buy output:', error);
    }
    return '0';
  }, [debouncedBuyAmount, buyQuote, pairExists]);

  const calculateSellOutput = useMemo(() => {
    if (!debouncedSellAmount || !sellQuote || isNaN(Number(debouncedSellAmount)) || !pairExists || parseFloat(debouncedSellAmount) <= 0) {
      return '0';
    }
    
    try {
      if (Array.isArray(sellQuote) && sellQuote.length > 1) {
        // Direct use of the quote since it's already calculated for the actual sell amount
        const outputAmount = sellQuote[1] as bigint;
        return formatEther(outputAmount);
      }
    } catch (error) {
      console.error('Error calculating sell output:', error);
    }
    return '0';
  }, [debouncedSellAmount, sellQuote, pairExists]);

  // Processing state combining local loading and approval states
  const isProcessingOverall = isLoading || approvalPending || isConfirming;
  
  // Status message for sell transactions
  const sellStatusMessage = approvalPending ? `Approving tokens with ${spenderName}...` : 
                           approvalError ? `Approval failed: ${approvalError}` :
                           isLoading ? 'Processing transaction...' : '';

  // Check if SushiSwap is available on this network
  if (!sushiV2Addresses) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6">
        <h3 className="text-red-300 font-semibold mb-2">SushiSwap Not Available</h3>
        <p className="text-red-200 text-sm">
          SushiSwap V2 is not available on this network (Chain ID: {chainId}).
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-slate-400 mb-4">Please connect your wallet to trade tokens on SushiSwap.</p>
          <div className="text-xs text-amber-300 bg-amber-400/10 rounded-lg p-3 border border-amber-400/20">
            <p className="mb-1">📊 You can view token information without connecting a wallet.</p>
            <p>🔒 Connect your wallet to enable SushiSwap trading functionality.</p>
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
            <h3 className="text-xl font-semibold text-white flex items-center">
              <span className="text-blue-400 mr-2">🍣</span>
              Trade {tokenSymbol as string || 'Token'} on SushiSwap
            </h3>
            <div className="bg-slate-600 px-3 py-1 rounded-lg">
              <span className="text-sm text-slate-300">
                {isConfirming ? 'Transaction Pending...' : isConfirmed ? 'Transaction Confirmed!' : pairExists ? 'Ready to Trade' : 'No Pool Available'}
              </span>
            </div>
          </div>
        )}
        
        {/* Pool Status Alert */}
        {!pairExists && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
            <div className="flex items-center">
              <span className="text-yellow-400 mr-2">⚠️</span>
              <div>
                <p className="text-yellow-300 text-sm font-medium">No SushiSwap Pool Available</p>
                <p className="text-yellow-200 text-xs mt-1">
                  Create a liquidity pool first to enable trading for this token.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Balance Display */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="text-center bg-slate-800 rounded-lg p-3">
            <p className="text-sm text-slate-400 mb-1">Your CORE Balance</p>
            <p className="text-base font-medium text-white">
              {ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000'} CORE
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
                CORE Amount to Spend
              </label>
              <input
                type="number"
                placeholder="0.0"
                value={buyAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBuyAmount(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-400"
              />
              <div className="text-sm text-slate-400 mt-1">
                {pairExists ? (
                  `You will receive: ~${parseFloat(calculateBuyOutput).toFixed(6)} ${tokenSymbol as string || 'tokens'}`
                ) : (
                  <span className="text-yellow-400">⚠️ No pool available - cannot estimate output</span>
                )}
              </div>
            </div>
            
            <button
              onClick={handleBuyTokens}
              disabled={!pairExists || isLoading || isConfirming || !buyAmount || parseFloat(buyAmount) > parseFloat(formatEther(ethBalance?.value || 0n))}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {!pairExists ? 'Pool Not Available' :
               isLoading || isConfirming ? 'Processing...' : 
               `Buy ${tokenSymbol as string || 'Tokens'} via SushiSwap`}
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
                {pairExists ? (
                  `You will receive: ~${parseFloat(calculateSellOutput).toFixed(6)} CORE`
                ) : (
                  <span className="text-yellow-400">⚠️ No pool available - cannot estimate output</span>
                )}
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
              disabled={!pairExists || isProcessingOverall || !sellAmount || parseFloat(sellAmount) > parseFloat(formatEther(tokenBalance as bigint || 0n))}
              className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {!pairExists ? 'Pool Not Available' :
               isProcessingOverall ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {approvalPending ? 'Approving...' : 'Processing...'}
                </span>
              ) : (
                `Sell ${tokenSymbol as string || 'Tokens'} via SushiSwap`
              )}
            </button>
            
            {/* Help text */}
            <div className="text-xs text-slate-400 text-center">
              {!pairExists ? 
                'Create a SushiSwap pool first to enable trading.' :
                needsApproval ? 
                  'Token approval for SushiSwap will be handled automatically when you sell.' :
                  'Ready to sell via SushiSwap - no approval needed.'
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
            <strong>🍣 SushiSwap Integration:</strong> This interface trades directly through SushiSwap V2 on Core DAO. 
            Prices are fetched in real-time from SushiSwap pools with 5% slippage protection.
            {pairExists && (
              <div className="mt-2 text-xs text-green-400">
                ✅ SushiSwap pool is available and ready for trading
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BuySellTokens;
