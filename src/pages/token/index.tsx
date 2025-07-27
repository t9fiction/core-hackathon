import React, { useState, useEffect, useCallback } from "react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { Address, formatEther } from 'viem';
import { TokenDeploymentForm } from '../../components/TokenDeployment';
import { DEXPoolCreator } from '../../components/DEX';
import { PoolInformation } from '../../components/PoolInfo';
import { LiquidityManager } from '../../components/LiquidityManagement';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
}

const Token = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  
  // State for managing token operations
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<Address | undefined>();
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [tokenAddressInput, setTokenAddressInput] = useState('');
  const [activeTab, setActiveTab] = useState<'deploy' | 'pool' | 'lock'>('deploy');
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

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

  // Fetch token data directly using hooks
  useEffect(() => {
    if (tokenAddresses && tokenAddresses.length > 0) {
      setIsLoadingTokens(true);
      setUserTokens([]); // Reset token array
    } else {
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

  // Callback functions for component interactions
  const handleTokenDeploymentSuccess = (hash: string) => {
    console.log('Token deployed successfully:', hash);
    // Refresh pool information
    setRefreshTrigger(prev => prev + 1);
  };

  const handlePoolCreated = (poolInfo: any) => {
    console.log('Pool created:', poolInfo);
    // Refresh pool information
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLiquidityAdded = (txHash: string) => {
    console.log('Liquidity added:', txHash);
    // Refresh pool information
    setRefreshTrigger(prev => prev + 1);
  };

  const handleTokenSelection = () => {
    if (tokenAddressInput) {
      try {
        setSelectedTokenAddress(tokenAddressInput as Address);
        // Try to extract symbol from input if provided
        const parts = tokenAddressInput.split(':');
        if (parts.length > 1) {
          setSelectedTokenSymbol(parts[1].toUpperCase());
        } else {
          setSelectedTokenSymbol('TOKEN');
        }
      } catch (error) {
        alert('Invalid token address format');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8">
      {/* Hidden TokenDataFetcher components for each token */}
      {tokenAddresses && tokenAddresses.map((tokenAddress) => (
        <TokenDataFetcher
          key={tokenAddress}
          tokenAddress={tokenAddress as string}
          onDataFetched={handleTokenDataFetched}
        />
      ))}
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Token Management Center
          </h1>
          <p className="text-gray-300 text-lg">
            Deploy, manage, and create liquidity for your tokens
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Token Operations */}
          <div className="lg:col-span-2 space-y-8">
            {/* Token Selection for Management */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <span className="text-yellow-400 mr-2">🎯</span>
                Select Token for Management
              </h3>
              <div className="flex gap-4">
                {
                  isConnected && userTokens.length > 0 ? (
                    <select
                      value={selectedTokenAddress}
                      onChange={(e) => {
                        const selectedToken = userTokens.find(token => token.address === e.target.value);
                        setSelectedTokenAddress(selectedToken?.address);
                        setSelectedTokenSymbol(selectedToken?.symbol);
                      }}
                      className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                    >
                      <option value="">-- Select a Token --</option>
                      {userTokens.map((token) => (
                        <option key={token.address} value={token.address}>
                          {token.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-400">No Tokens Available</p>
                  )
                }
              </div>
              {selectedTokenAddress && (
                <div className="mt-3 p-3 bg-green-900/30 border border-green-500/50 rounded">
                  <p className="text-green-300 text-sm">
                    Selected: {selectedTokenSymbol} ({selectedTokenAddress.slice(0, 8)}...{selectedTokenAddress.slice(-6)})
                  </p>
                </div>
              )}
            </div>

            {/* Tabbed Management Interface */}
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-700">
                <button
                  onClick={() => setActiveTab('deploy')}
                  className={`px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'deploy'
                      ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="mr-2">🚀</span>
                  Deploy Token
                </button>
                <button
                  onClick={() => setActiveTab('pool')}
                  className={`px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'pool'
                      ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="mr-2">💧</span>
                  DEX Pools
                </button>
                <button
                  onClick={() => setActiveTab('lock')}
                  className={`px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'lock'
                      ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="mr-2">🔒</span>
                  Token Lock
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'deploy' && (
                  <TokenDeploymentForm onDeploymentSuccess={handleTokenDeploymentSuccess} />
                )}
                
                {activeTab === 'pool' && (
                  <div>
                    {selectedTokenAddress ? (
                      <DEXPoolCreator 
                        tokenAddress={selectedTokenAddress}
                        tokenSymbol={selectedTokenSymbol}
                        onPoolCreated={handlePoolCreated}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">💧</div>
                        <h3 className="text-xl font-bold mb-2">No Token Selected</h3>
                        <p className="text-gray-400">
                          Please select a token above to create DEX pools
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'lock' && (
                  <div>
                    {selectedTokenAddress ? (
                      <LiquidityManager 
                        tokenAddress={selectedTokenAddress}
                        tokenSymbol={selectedTokenSymbol}
                        onLiquidityAdded={handleLiquidityAdded}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">🔒</div>
                        <h3 className="text-xl font-bold mb-2">No Token Selected</h3>
                        <p className="text-gray-400">
                          Please select a token above to lock tokens for trust building
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Information and Stats */}
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">Connection Status</h3>
              {isConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    <span className="text-sm">Connected</span>
                  </div>
                  <p className="text-xs text-gray-400 break-all">{address}</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-3">
                    Connect your wallet to deploy tokens
                  </p>
                  <ConnectButton />
                </div>
              )}
            </div>

            {/* Pool Information */}
            <PoolInformation 
              tokenAddress={selectedTokenAddress}
              tokenSymbol={selectedTokenSymbol}
              refreshTrigger={refreshTrigger}
            />

            {/* Platform Stats */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">Platform Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Total Tokens</span>
                  <span className="font-bold">1,247</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Total Locked</span>
                  <span className="font-bold">$2.4M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Active Proposals</span>
                  <span className="font-bold">23</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">
                    Rug Pulls Prevented
                  </span>
                  <span className="font-bold text-green-400">187</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Token;