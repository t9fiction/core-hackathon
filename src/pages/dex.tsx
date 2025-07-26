import React, { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { Address } from 'viem';
import { PUMPFUN_FACTORY_ABI } from '../lib/contracts/abis';
import { getContractAddresses } from '../lib/contracts/addresses';
import DEXPoolCreator from '../components/DEX/DEXPoolCreator';
import PoolInformation from '../components/PoolInfo/PoolInformation';
import LiquidityManager from '../components/LiquidityManagement/LiquidityManager';

const DEXPage = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'info' | 'liquidity'>('create');
  const [selectedToken, setSelectedToken] = useState<Address | ''>('');
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  
  // Debug logs
  console.log('DEX Page Debug:', {
    address,
    isConnected,
    chainId,
    contractAddresses,
    pumpfunFactory: contractAddresses?.PUMPFUN_FACTORY
  });

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

  
  // Debug token addresses
  console.log('Token Addresses Data:', {
    tokenAddresses,
    enabled: isConnected && !!address && !!contractAddresses?.PUMPFUN_FACTORY,
    args: [address]
  });

  useEffect(() => {
    const fetchTokenDetails = async () => {
      if (!tokenAddresses || !Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
        setUserTokens([]);
        return;
      }

      setIsLoadingTokens(true);
      try {
        console.log("TokenAddresses:", tokenAddresses);
        console.log("ChainId:", chainId);
        const url = `/api/token-info?chainId=${chainId}&addresses=${tokenAddresses.join(',')}`;
        console.log("Fetching URL:", url);
        
        const response = await fetch(url);
        console.log("Response status:", response.status);
        console.log("Response ok:", response.ok);
        
        const data = await response.json();
        console.log("Response data:", data);
        
        if (data.success && data.tokens) {
          setUserTokens(data.tokens);
        } else {
          setUserTokens([]);
        }
      } catch (error) {
        console.error('Error fetching token details:', error);
        setUserTokens([]);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    fetchTokenDetails();
  }, [tokenAddresses, chainId]);

  const tabs = [
    { id: 'create' as const, label: 'Create Pool', icon: '🏗️' },
    { id: 'info' as const, label: 'Pool Info', icon: '📊' },
    { id: 'liquidity' as const, label: 'Manage Liquidity', icon: '💧' }
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
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="text-left py-3 px-4 text-gray-300 font-medium">Token</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-medium">Symbol</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-medium">Total Supply</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-medium">Address</th>
                          <th className="text-center py-3 px-4 text-gray-300 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTokens.map((token) => (
                          <tr 
                            key={token.address} 
                            className={`
                              border-b border-gray-700/50 transition-all duration-300
                              ${selectedToken === token.address 
                                ? 'bg-gradient-to-r from-cyan-600/10 to-purple-600/10' 
                                : 'hover:bg-gray-700/30'
                              }
                            `}
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                  {token.symbol?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <div className="font-semibold text-white text-sm">{token.name || 'Unknown Token'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-gray-300 font-mono text-sm">
                              {token.symbol || 'N/A'}
                            </td>
                            <td className="py-4 px-4 text-gray-300 text-sm">
                              {token.totalSupply ? Number(token.totalSupply).toLocaleString() : 'N/A'}
                            </td>
                            <td className="py-4 px-4 text-gray-400 font-mono text-xs">
                              {token.address.slice(0, 8)}...{token.address.slice(-6)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <button
                                onClick={() => setSelectedToken(token.address)}
                                className={`
                                  px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300
                                  ${selectedToken === token.address
                                    ? 'bg-gradient-to-r from-green-600 to-green-500 text-white cursor-default'
                                    : 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white hover:shadow-lg hover:shadow-cyan-500/25'
                                  }
                                `}
                                disabled={selectedToken === token.address}
                              >
                                {selectedToken === token.address ? 'Selected ✓' : 'Select'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🪙</div>
                    <h4 className="text-lg font-semibold text-white mb-2">No Tokens Found</h4>
                    <p className="text-gray-400 mb-4">
                      You haven't deployed any tokens yet. Create your first token to get started!
                    </p>
                    <a
                      href="/token"
                      className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
                    >
                      Deploy Token
                      <span className="ml-2">🚀</span>
                    </a>
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

      case 'liquidity':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Manage Liquidity</h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                Add or remove liquidity from existing pools. Lock liquidity to build trust and stabilize your token's trading environment.
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
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="text-left py-3 px-4 text-gray-300 font-medium">Token</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-medium">Symbol</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-medium">Total Supply</th>
                          <th className="text-left py-3 px-4 text-gray-300 font-medium">Address</th>
                          <th className="text-center py-3 px-4 text-gray-300 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTokens.map((token) => (
                          <tr 
                            key={token.address} 
                            className={`
                              border-b border-gray-700/50 transition-all duration-300
                              ${selectedToken === token.address 
                                ? 'bg-gradient-to-r from-cyan-600/10 to-purple-600/10' 
                                : 'hover:bg-gray-700/30'
                              }
                            `}
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                  {token.symbol?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <div className="font-semibold text-white text-sm">{token.name || 'Unknown Token'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-gray-300 font-mono text-sm">
                              {token.symbol || 'N/A'}
                            </td>
                            <td className="py-4 px-4 text-gray-300 text-sm">
                              {token.totalSupply ? Number(token.totalSupply).toLocaleString() : 'N/A'}
                            </td>
                            <td className="py-4 px-4 text-gray-400 font-mono text-xs">
                              {token.address.slice(0, 8)}...{token.address.slice(-6)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <button
                                onClick={() => setSelectedToken(token.address)}
                                className={`
                                  px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300
                                  ${selectedToken === token.address
                                    ? 'bg-gradient-to-r from-green-600 to-green-500 text-white cursor-default'
                                    : 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white hover:shadow-lg hover:shadow-cyan-500/25'
                                  }
                                `}
                                disabled={selectedToken === token.address}
                              >
                                {selectedToken === token.address ? 'Selected ✓' : 'Select'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🪙</div>
                    <h4 className="text-lg font-semibold text-white mb-2">No Tokens Found</h4>
                    <p className="text-gray-400 mb-4">
                      You haven't deployed any tokens yet. Create your first token to get started!
                    </p>
                    <a
                      href="/token"
                      className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
                    >
                      Deploy Token
                      <span className="ml-2">🚀</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h4 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h4>
                <p className="text-gray-300">
                  Please connect your wallet to view your tokens and manage liquidity.
                </p>
              </div>
            )}
            
            {/* Liquidity Manager Component */}
            {selectedToken && (
              <LiquidityManager 
                tokenAddress={selectedToken as Address}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-cyan-900">
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

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-2 border border-gray-700">
              <div className="flex space-x-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300
                      ${activeTab === tab.id
                        ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-lg shadow-cyan-500/25'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                      }
                    `}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
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
              <h3 className="text-xl font-bold text-white mb-2">Secure Liquidity</h3>
              <p className="text-gray-300">
                Lock your liquidity with customizable time periods to build community trust
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
                Create your token first, then return here to set up trading pools and manage liquidity
              </p>
              <a
                href="/token"
                className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
              >
                Deploy Token
                <span className="ml-2">🚀</span>
              </a>
            </div>
          </div>
        </div>
      </div>
  );
};

export default DEXPage;
