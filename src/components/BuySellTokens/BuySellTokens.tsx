import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useBalance } from 'wagmi';
import { Address, formatEther } from 'viem';
import { PUMPFUN_TOKEN_ABI } from '../../lib/contracts/abis';

interface BuySellTokensProps {
  tokenAddress: Address;
}

export default function BuySellTokens({ tokenAddress }: BuySellTokensProps) {
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  
  const { address, isConnected } = useAccount();

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

  const handleBuyTokens = async () => {
    if (!tokenAddress || !buyAmount) return;
    setIsLoading(true);
    
    try {
      // Buy/sell functionality would need to be implemented in the contract
      console.log('Buy tokens functionality not yet implemented in contract');
      alert('Buy functionality needs to be implemented in the smart contract');
    } catch (error: any) {
      console.error('Error buying tokens:', error);
      alert('Failed to buy tokens: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSellTokens = async () => {
    if (!tokenAddress || !sellAmount) return;
    setIsLoading(true);
    
    try {
      // Buy/sell functionality would need to be implemented in the contract
      console.log('Sell tokens functionality not yet implemented in contract');
      alert('Sell functionality needs to be implemented in the smart contract');
    } catch (error: any) {
      console.error('Error selling tokens:', error);
      alert('Failed to sell tokens: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

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

  const calculateBuyOutput = () => {
    if (!buyAmount) return '0';
    // Placeholder calculation - would need actual price from DEX
    return (parseFloat(buyAmount) / 0.001).toFixed(6);
  };

  const calculateSellOutput = () => {
    if (!sellAmount) return '0';
    // Placeholder calculation - would need actual price from DEX
    return (parseFloat(sellAmount) * 0.001).toFixed(6);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">
            Trade {tokenSymbol as string || 'Token'}
          </h3>
          <div className="bg-gray-700 px-3 py-1 rounded-lg">
            <span className="text-sm text-gray-300">Price: ~0.001 ETH</span>
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
                You will receive: ~{calculateBuyOutput()} {tokenSymbol as string || 'tokens'}
              </div>
            </div>
            
            <button
              onClick={handleBuyTokens}
              disabled={isLoading || !buyAmount || parseFloat(buyAmount) > parseFloat(formatEther(ethBalance?.value || 0n))}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Buying...' : `Buy ${tokenSymbol as string || 'Tokens'}`}
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
                You will receive: ~{calculateSellOutput()} ETH
              </div>
            </div>
            
            <button
              onClick={handleSellTokens}
              disabled={isLoading || !sellAmount || parseFloat(sellAmount) > parseFloat(formatEther(tokenBalance as bigint || 0n))}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Selling...' : `Sell ${tokenSymbol as string || 'Tokens'}`}
            </button>
          </div>
        )}
      </div>

      {/* Notice */}
      <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-2xl p-4">
        <div className="text-yellow-200">
          <strong>Note:</strong> This trading interface requires buy/sell functions to be implemented in the PumpFun contract. 
          Currently, only basic token functionality is available.
        </div>
      </div>
    </div>
  );
}
