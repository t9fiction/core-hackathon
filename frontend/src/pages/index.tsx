import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';

const PumpFunApp = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
              PumpFun Factory
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Create sustainable meme tokens with built-in anti-rug pull mechanisms, 
              community governance, and automated liquidity protection.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full">
                🔒 Anti-Rug Pull
              </span>
              <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full">
                🏛️ Governance
              </span>
              <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full">
                🔐 Liquidity Locked
              </span>
              <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full">
                📊 Tiered Pricing
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Supply Tiers Info */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">Supply Tiers & Pricing</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-xl p-6 border-2 border-green-500/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-green-400">Standard</h3>
                <span className="bg-green-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                  Most Popular
                </span>
              </div>
              <p className="text-3xl font-bold mb-2">0.05 ETH</p>
              <p className="text-gray-400 mb-4">Up to 100M tokens</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <span className="text-green-400 mr-2">✓</span>
                  Anti-rug pull protection
                </li>
                <li className="flex items-center">
                  <span className="text-green-400 mr-2">✓</span>
                  30-day liquidity lock
                </li>
                <li className="flex items-center">
                  <span className="text-green-400 mr-2">✓</span>
                  Community governance
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-6 border-2 border-yellow-500/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-yellow-400">Premium</h3>
                <span className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                  3x Fee
                </span>
              </div>
              <p className="text-3xl font-bold mb-2">0.15 ETH</p>
              <p className="text-gray-400 mb-4">Up to 500M tokens</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <span className="text-yellow-400 mr-2">✓</span>
                  All Standard features
                </li>
                <li className="flex items-center">
                  <span className="text-yellow-400 mr-2">✓</span>
                  Higher supply limit
                </li>
                <li className="flex items-center">
                  <span className="text-yellow-400 mr-2">✓</span>
                  Priority support
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-6 border-2 border-purple-500/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-purple-400">Ultimate</h3>
                <span className="bg-purple-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                  10x Fee
                </span>
              </div>
              <p className="text-3xl font-bold mb-2">0.50 ETH</p>
              <p className="text-gray-400 mb-4">Up to 1B tokens</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <span className="text-purple-400 mr-2">✓</span>
                  All Premium features
                </li>
                <li className="flex items-center">
                  <span className="text-purple-400 mr-2">✓</span>
                  Maximum supply limit
                </li>
                <li className="flex items-center">
                  <span className="text-purple-400 mr-2">✓</span>
                  VIP support
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Link href="/deploy" className="group">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors group-hover:bg-gray-750">
              <div className="text-3xl mb-4">🚀</div>
              <h3 className="text-xl font-bold mb-2">Deploy Token</h3>
              <p className="text-gray-400 text-sm">Create your sustainable meme token with anti-rug pull protection</p>
            </div>
          </Link>
          
          <Link href="/tokens" className="group">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-green-500 transition-colors group-hover:bg-gray-750">
              <div className="text-3xl mb-4">🪙</div>
              <h3 className="text-xl font-bold mb-2">My Tokens</h3>
              <p className="text-gray-400 text-sm">Manage your deployed tokens and view analytics</p>
            </div>
          </Link>
          
          <Link href="/governance" className="group">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-colors group-hover:bg-gray-750">
              <div className="text-3xl mb-4">🏛️</div>
              <h3 className="text-xl font-bold mb-2">Governance</h3>
              <p className="text-gray-400 text-sm">Participate in community governance and voting</p>
            </div>
          </Link>
          
          <Link href="/trading" className="group">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-yellow-500 transition-colors group-hover:bg-gray-750">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-2">Trading</h3>
              <p className="text-gray-400 text-sm">Trade tokens and manage liquidity pools</p>
            </div>
          </Link>
        </div>

        {/* Wallet Connection Section */}
        <div className="text-center">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-md mx-auto">
            <h3 className="text-xl font-bold mb-4">Get Started</h3>
            {isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-sm">Wallet Connected</span>
                </div>
                <p className="text-xs text-gray-400 break-all">{address}</p>
                <div className="flex gap-2 justify-center">
                  <Link href="/deploy" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors">
                    Deploy Token
                  </Link>
                  <Link href="/tokens" className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded text-sm transition-colors">
                    View Tokens
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-4">
                  Connect your wallet to start creating tokens
                </p>
                <ConnectButton />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PumpFunApp;