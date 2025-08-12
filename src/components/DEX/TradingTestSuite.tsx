import React, { useState } from 'react';
import { Address } from 'viem';
import { BuySellTokens } from '../BuySellTokens/BuySellTokens';
import SushiSwapDebugger from './SushiSwapDebugger';

interface TradingTestSuiteProps {
  tokenAddress: Address;
  tokenSymbol?: string;
  tokenName?: string;
}

export const TradingTestSuite: React.FC<TradingTestSuiteProps> = ({
  tokenAddress,
  tokenSymbol = "TOKEN",
  tokenName = "Test Token"
}) => {
  const [activeView, setActiveView] = useState<'trading' | 'debug'>('trading');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
          🧪 Trading Test Suite for {tokenSymbol}
        </h2>
        <p className="text-gray-300 text-sm">
          Test and debug your SushiSwap V2 trading functionality on Core DAO
        </p>
        <div className="mt-3 text-xs text-gray-400 font-mono">
          Token: {tokenAddress}
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex space-x-1 bg-gray-700 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveView('trading')}
          className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeView === 'trading'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600'
          }`}
        >
          🍣 Trading Interface
        </button>
        <button
          onClick={() => setActiveView('debug')}
          className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeView === 'debug'
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600'
          }`}
        >
          🔍 Debug Console
        </button>
      </div>

      {/* Content */}
      {activeView === 'trading' && (
        <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-blue-300 font-semibold mb-2">🎯 Trading Interface</h3>
            <p className="text-blue-200 text-sm mb-4">
              Use this interface to test buying and selling {tokenSymbol} tokens. 
              Make sure you have a liquidity pool created first.
            </p>
          </div>
          
          <BuySellTokens
            tokenAddress={tokenAddress}
            tokenSymbol={tokenSymbol}
            tokenName={tokenName}
            embedded={false}
            onTransactionComplete={() => {
              console.log('🎉 Transaction completed successfully!');
            }}
          />
        </div>
      )}

      {activeView === 'debug' && (
        <div className="space-y-4">
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <h3 className="text-purple-300 font-semibold mb-2">🔧 Debug Console</h3>
            <p className="text-purple-200 text-sm mb-4">
              Use this console to diagnose issues with your token's SushiSwap integration.
              It will show you contract addresses, pool status, and test quotes.
            </p>
          </div>
          
          <SushiSwapDebugger
            tokenAddress={tokenAddress}
            tokenSymbol={tokenSymbol}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
        <h3 className="text-gray-200 font-semibold mb-4">⚡ Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-900/20 border border-green-500/30 rounded p-4">
            <h4 className="text-green-300 font-medium mb-2">✅ Prerequisites</h4>
            <ul className="text-green-200 text-sm space-y-1">
              <li>• Wallet connected</li>
              <li>• Token authorized for trading</li>
              <li>• Liquidity pool exists</li>
              <li>• Sufficient token/CORE balance</li>
            </ul>
          </div>
          
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-4">
            <h4 className="text-yellow-300 font-medium mb-2">⚠️ Common Issues</h4>
            <ul className="text-yellow-200 text-sm space-y-1">
              <li>• No liquidity pool found</li>
              <li>• Insufficient balance</li>
              <li>• Token not approved</li>
              <li>• Network configuration</li>
            </ul>
          </div>
          
          <div className="bg-blue-900/20 border border-blue-500/30 rounded p-4">
            <h4 className="text-blue-300 font-medium mb-2">🔧 Troubleshooting</h4>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• Check debug console</li>
              <li>• Verify contract addresses</li>
              <li>• Test with small amounts</li>
              <li>• Check browser console</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Network Status */}
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
        <h4 className="text-gray-300 font-medium mb-3">🌐 Current Configuration</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Network:</span>
            <div className="text-gray-200 font-mono">Core DAO</div>
          </div>
          <div>
            <span className="text-gray-400">DEX:</span>
            <div className="text-gray-200">SushiSwap V2</div>
          </div>
          <div>
            <span className="text-gray-400">Token:</span>
            <div className="text-gray-200">{tokenSymbol}</div>
          </div>
          <div>
            <span className="text-gray-400">Pair:</span>
            <div className="text-gray-200">{tokenSymbol}/CORE</div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/20 rounded-lg p-6">
        <h4 className="text-green-300 font-semibold mb-3">💡 Testing Tips</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h5 className="text-green-400 font-medium mb-2">For Buying:</h5>
            <ul className="text-green-200 space-y-1 list-disc list-inside">
              <li>Start with small CORE amounts (0.001 - 0.01)</li>
              <li>Ensure you have sufficient CORE balance</li>
              <li>Check that a pool exists first</li>
              <li>Monitor the estimated output</li>
            </ul>
          </div>
          <div>
            <h5 className="text-blue-400 font-medium mb-2">For Selling:</h5>
            <ul className="text-blue-200 space-y-1 list-disc list-inside">
              <li>Make sure you have tokens to sell</li>
              <li>Token approval will be handled automatically</li>
              <li>Start with small token amounts</li>
              <li>Check the estimated CORE output</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingTestSuite;
