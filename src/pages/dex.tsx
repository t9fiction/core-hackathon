import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { Address, formatEther } from 'viem';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from '../lib/contracts/abis';
import { getContractAddresses } from '../lib/contracts/addresses';
import DEXPoolCreator from '../components/DEX/DEXPoolCreator';
import PoolInformation from '../components/PoolInfo/PoolInformation';
import BuySellTokens from '../components/BuySellTokens/BuySellTokens';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
}

const DEXPage = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'info' | 'buysell'>('create');
  const [selectedToken, setSelectedToken] = useState<Address | ''>('');
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  
  // Debug logs - commented out to prevent infinite logging
  // console.log('DEX Page Debug:', {
  //   address,
  //   isConnected,
  //   chainId,
  //   contractAddresses,
  //   pumpfunFactory: contractAddresses?.PUMPFUN_FACTORY
  // });

  // Fetch user's deployed tokens
  const { data: tokenAddresses } = useReadContract({
    address: contractAddresses?.PUMPFUN_FACTORY as `0x${string}`,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: 'getTokensByCreator',
    args: [address!],
    query: {
      enabled: isConnected && !!address && !!contractAddresses?.PUMPFUN_FACTORY,
    },
  });

  
  // Debug token addresses - commented out to prevent infinite logging
  // console.log('Token Addresses Data:', {
  //   tokenAddresses,
  //   enabled: isConnected && !!address && !!contractAddresses?.PUMPFUN_FACTORY,
  //   args: [address]
  // });

  // Fetch token data directly using hooks
  useEffect(() => {
    // console.log("TokenManager: Address List:", tokenAddresses);
    // console.log("TokenManager: chainId:", chainId);

    if (tokenAddresses && tokenAddresses.length > 0) {
      // console.log("TokenManager: Found tokens, preparing to fetch details...");
      setIsLoadingTokens(true);
      setUserTokens([]); // Reset token array
    } else {
      // console.log("TokenManager: No tokens found");
      setUserTokens([]);
      setIsLoadingTokens(false);
    }
  }, [tokenAddresses, chainId]);

  const handleTokenDataFetched = useCallback((data: TokenInfo) => {
    setUserTokens(prevTokens => {
      const existingIndex = prevTokens.findIndex((token) => token.address === data.address);
      
      if (existingIndex >= 0) {
        // Check if the data has actually changed before updating
        const existingToken = prevTokens[existingIndex];
        const hasChanged = JSON.stringify(existingToken) !== JSON.stringify(data);
        
        if (hasChanged) {
          // Update existing token only if data has changed
          return prevTokens.map((token) => 
            token.address === data.address ? data : token
          );
        }
        // Return the same array if no changes to prevent re-render
        return prevTokens;
      } else {
        // Add new token
        return [...prevTokens, data];
      }
    });
  }, []);

  // Separate useEffect to handle loading state management
  useEffect(() => {
    if (tokenAddresses && userTokens.length === tokenAddresses.length && userTokens.length > 0) {
      setIsLoadingTokens(false);
    }
  }, [tokenAddresses, userTokens.length]);

  // TokenDataFetcher component for each token
  const TokenDataFetcher = ({ tokenAddress, onDataFetched }: { tokenAddress: string, onDataFetched: (data: TokenInfo) => void }) => {
    // Fetch name, symbol, totalSupply from token contract
    const { data: name } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: "name",
    });
    const { data: symbol } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: "symbol",
    });
    const { data: totalSupply } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: "totalSupply",
    });

    useEffect(() => {
      if (name && symbol && totalSupply !== undefined) {
        onDataFetched({
          address: tokenAddress,
          name: name as string,
          symbol: symbol as string,
          totalSupply: formatEther(totalSupply),
        })
      }
    }, [name, symbol, totalSupply, onDataFetched, tokenAddress]);

    return null; // Component doesn't render anything
  };

  const tabs = [
    { id: 'create' as const, label: 'Create Pool', icon: '🏗️' },
    { id: 'info' as const, label: 'Pool Info', icon: '📊' },
    { id: 'buysell' as const, label: 'Buy/Sell', icon: '💱' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'create':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Create DEX Pool</h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                Create a new liquidity pool for your token on PumpFun DEX. Set up trading pairs and enable decentralized trading.
              </p>
            </div>
            <DEXPoolCreator onPoolCreated={(tokenAddress) => {
              setSelectedToken(tokenAddress);
              setActiveTab('info');
            }} />
          </div>
        );

      case 'info':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Pool Information</h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                View live data for all active pools, including token statistics, liquidity levels, and trading activity.
              </p>
            </div>
            
            {/* Token Selection */}
            {isConnected ? (
              <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700 mb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Select Your Token</h3>
                
                {isLoadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                    <span className="ml-3 text-gray-300">Loading your tokens...</span>
                  </div>
                ) : userTokens.length > 0 ? (
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value as Address)}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  >
                    <option value="">-- Select a Token --</option>
                    {userTokens.map((token) => (
                      <option key={token.address} value={token.address}>
                        {token.name} ({token.symbol})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🪙</div>
                    <h4 className="text-lg font-semibold text-white mb-2">No Tokens Found</h4>
                    <p className="text-gray-400 mb-4">
                      You haven&apos;t deployed any tokens yet. Create your first token to get started!
                    </p>
                    <Link
                      href="/token"
                      className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
                    >
                      Deploy Token
                      <span className="ml-2">🚀</span>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h4 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h4>
                <p className="text-gray-300">
                  Please connect your wallet to view your tokens and pool information.
                </p>
              </div>
            )}
            
            {/* Pool Information Component */}
            {selectedToken && (
              <PoolInformation tokenAddress={selectedToken as Address} />
            )}
          </div>
        );

      case 'buysell':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Buy/Sell Tokens</h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                Buy and sell tokens directly on the DEX with instant execution and competitive pricing.
              </p>
            </div>
            
            {/* Token Selection */}
            {isConnected ? (
              <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700 mb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Select Your Token</h3>
                
                {isLoadingTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                    <span className="ml-3 text-gray-300">Loading your tokens...</span>
                  </div>
                ) : userTokens.length > 0 ? (
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value as Address)}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  >
                    <option value="">-- Select a Token --</option>
                    {userTokens.map((token) => (
                      <option key={token.address} value={token.address}>
                        {token.name} ({token.symbol})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🪙</div>
                    <h4 className="text-lg font-semibold text-white mb-2">No Tokens Found</h4>
                    <p className="text-gray-400 mb-4">
                      You haven&apos;t deployed any tokens yet. Create your first token to get started!
                    </p>
                    <Link
                      href="/token"
                      className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
                    >
                      Deploy Token
                      <span className="ml-2">🚀</span>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h4 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h4>
                <p className="text-gray-300">
                  Please connect your wallet to view your tokens and trade.
                </p>
              </div>
            )}
            
            {/* Buy/Sell Component */}
            {selectedToken && (
              <BuySellTokens tokenAddress={selectedToken as Address} />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-cyan-900">
        {/* Hidden TokenDataFetcher components for each token */}
        {tokenAddresses && tokenAddresses.map((tokenAddress) => (
          <TokenDataFetcher
            key={tokenAddress}
            tokenAddress={tokenAddress as string}
            onDataFetched={handleTokenDataFetched}
          />
        ))}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent mb-4">
              PumpFun DEX
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Your decentralized exchange for token trading, pool creation, and liquidity management
            </p>
          </div>

          {/* Switch-style Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="relative bg-gray-800/50 backdrop-blur-md rounded-2xl p-1 border border-gray-700 shadow-xl">
              <div className="flex relative">
                {/* Active tab background slider */}
                <div 
                  className="absolute top-1 bottom-1 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-xl transition-all duration-300 ease-in-out shadow-lg shadow-cyan-500/25"
                  style={{
                    width: `${100 / tabs.length}%`,
                    left: `${(tabs.findIndex(tab => tab.id === activeTab) * 100) / tabs.length}%`
                  }}
                />
                
                {/* Tab buttons */}
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative z-10 flex items-center justify-center space-x-2 px-8 py-4 font-semibold transition-all duration-300
                      rounded-xl min-w-[160px] flex-1
                      ${activeTab === tab.id
                        ? 'text-white'
                        : 'text-gray-300 hover:text-white'
                      }
                    `}
                    style={{ width: `${100 / tabs.length}%` }}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tab Content */}
          <div className="max-w-6xl mx-auto">
            {renderTabContent()}
          </div>

          {/* Features Grid */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-white mb-2">Fast Trading</h3>
              <p className="text-gray-300">
                Lightning-fast token swaps with minimal slippage and competitive fees
              </p>
            </div>
            
            <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
              <div className="text-3xl mb-4">🔒</div>
              <h3 className="text-xl font-bold text-white mb-2">Anti-Rug Pull Protection</h3>
              <p className="text-gray-300">
                Lock tokens and ETH in the factory contract to prevent immediate dumps and build community trust
              </p>
            </div>
            
            <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
              <div className="text-3xl mb-4">📈</div>
              <h3 className="text-xl font-bold text-white mb-2">Real-time Data</h3>
              <p className="text-gray-300">
                Live pool statistics, price feeds, and trading analytics at your fingertips
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-cyan-600/20 to-purple-600/20 backdrop-blur-md rounded-2xl p-8 border border-cyan-500/30">
              <h3 className="text-2xl font-bold text-white mb-4">Ready to Launch Your Token?</h3>
              <p className="text-gray-300 mb-6">
                Create your token first, then return here to set up trading pools and lock tokens for trust building
              </p>
              <Link
                href="/token"
                className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
              >
                Deploy Token
                <span className="ml-2">🚀</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
  );
};

export default DEXPage;
