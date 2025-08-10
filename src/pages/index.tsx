import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import PublicTokenListing from '../components/PublicTokenListing/PublicTokenListing';
import TokenTradeModal from '../components/PublicTokenListing/TokenTradeModal';

const ChainCraftApp = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [selectedToken, setSelectedToken] = useState<{
    address: string;
    name: string;
    symbol: string;
  } | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

  const handleTokenSelect = (tokenAddress: string) => {
    // We'll need to fetch token details when selected
    setSelectedToken({
      address: tokenAddress,
      name: 'Loading...',
      symbol: 'Loading...'
    });
    setIsTradeModalOpen(true);
  };

  const closeTradeModal = () => {
    setIsTradeModalOpen(false);
    setSelectedToken(null);
  };

  const handleTransactionComplete = () => {
    // Close the modal after transaction completes
    closeTradeModal();
    // Optionally add any other actions like refreshing token list
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
    
        {/* Quick Actions */}
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Link href="/token" className="group">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-400 text-lg sm:text-xl">🚀</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm sm:text-base">Deploy Token</h3>
                    <p className="text-xs sm:text-sm text-slate-400">Create new token</p>
                  </div>
                </div>
              </div>
            </Link>
            
            <Link href="/tokens" className="group">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 text-lg sm:text-xl">🪙</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm sm:text-base">My Tokens</h3>
                    <p className="text-xs sm:text-sm text-slate-400">Manage portfolio</p>
                  </div>
                </div>
              </div>
            </Link>
            
            <Link href="/governance" className="group">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 text-lg sm:text-xl">🏛️</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm sm:text-base">Governance</h3>
                    <p className="text-xs sm:text-sm text-slate-400">Vote & propose</p>
                  </div>
                </div>
              </div>
            </Link>
            
            <Link href="/dex" className="group">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-400 text-lg sm:text-xl">💱</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm sm:text-base">Trade</h3>
                    <p className="text-xs sm:text-sm text-slate-400">Buy & sell tokens</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>


        {/* Main Token Listings Section */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sm:p-6">
          <PublicTokenListing onSelectToken={handleTokenSelect} />
        </div>

        {/* Supply Tiers Sidebar */}
        <div className="mt-6 sm:mt-8">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">Token Creation Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-white">Standard</h4>
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-medium">
                    Popular
                  </span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">0.05 ETH</p>
                <p className="text-sm text-slate-400 mb-3">Up to 100M tokens</p>
                <ul className="space-y-1 text-sm text-slate-300">
                  <li className="flex items-center">✓ Anti-rug protection</li>
                  <li className="flex items-center">✓ 30-day liquidity lock</li>
                  <li className="flex items-center">✓ Community governance</li>
                </ul>
              </div>
              
              <div className="border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-white">Premium</h4>
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-medium">
                    5x Fee
                  </span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">0.25 ETH</p>
                <p className="text-sm text-slate-400 mb-3">Up to 500M tokens</p>
                <ul className="space-y-1 text-sm text-slate-300">
                  <li className="flex items-center">✓ All Standard features</li>
                  <li className="flex items-center">✓ Higher supply limit</li>
                  <li className="flex items-center">✓ Priority support</li>
                </ul>
              </div>
              
              <div className="border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-white">Ultimate</h4>
                  <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs font-medium">
                    10x Fee
                  </span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">0.50 ETH</p>
                <p className="text-sm text-slate-400 mb-3">Up to 1B tokens</p>
                <ul className="space-y-1 text-sm text-slate-300">
                  <li className="flex items-center">✓ All Premium features</li>
                  <li className="flex items-center">✓ Maximum supply limit</li>
                  <li className="flex items-center">✓ VIP support</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trade Modal */}
      {selectedToken && (
        <TokenTradeModal
          tokenAddress={selectedToken.address}
          tokenName={selectedToken.name}
          tokenSymbol={selectedToken.symbol}
          isOpen={isTradeModalOpen}
          onClose={closeTradeModal}
          onTransactionComplete={handleTransactionComplete}
        />
      )}
    </div>
  );
};

export default ChainCraftApp;