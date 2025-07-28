import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { Address, formatEther } from 'viem';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from '../lib/contracts/abis';
import { getContractAddresses } from '../lib/contracts/addresses';
import { useTokenDEX } from '../lib/hooks/useTokenContracts';
import DEXPoolCreator from '../components/DEX/DEXPoolCreator';
import PoolInformation from '../components/PoolInfo/PoolInformation';
import BuySellTokens from '../components/BuySellTokens/BuySellTokens';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
}

// Liquidity Manager Component
const LiquidityManagerComponent = ({ tokenAddress }: { tokenAddress: Address }) => {
  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [poolTokenAmount, setPoolTokenAmount] = useState('');
  const [poolEthAmount, setPoolEthAmount] = useState('');
  const [poolFee, setPoolFee] = useState(3000);

  const dex = useTokenDEX(tokenAddress);
  const { address, isConnected } = useAccount();

  // Get selected token info
  const selectedTokenInfo = { symbol: 'TOKEN' }; // Simplified for now

  const dexHash = async () => {
    try {
      if (poolTokenAmount && poolEthAmount) {
        const result = await dex.createFactoryDEXPool(
          poolTokenAmount,
          poolEthAmount,
          poolFee
        );
        console.log('DEX Pool created successfully:', result);
      }
    } catch (error) {
      console.error('Error creating DEX pool:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Conditional Pool Creation */}
      {!dex.poolInfo ? (
        <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
            🚀 Create DEX Pool
            <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
              Uniswap V3
            </span>
          </h4>
          <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded">
            <p className="text-blue-200 text-sm">
              ℹ️ No liquidity pool exists for this token yet. Create one to enable trading on Uniswap.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-300 text-sm mb-1">
                Token Amount
              </label>
              <input
                type="number"
                value={poolTokenAmount}
                onChange={(e) => setPoolTokenAmount(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
                placeholder="5000"
              />
              <p className="text-xs text-gray-400 mt-1">Initial tokens for the pool</p>
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">
                ETH Amount
              </label>
              <input
                type="number"
                value={poolEthAmount}
                onChange={(e) => setPoolEthAmount(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
                placeholder="1.0"
                step="0.01"
              />
              <p className="text-xs text-gray-400 mt-1">Initial ETH for the pool</p>
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">
                Fee Tier
              </label>
              <select
                value={poolFee}
                onChange={(e) => setPoolFee(Number(e.target.value))}
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
              >
                <option value={500}>0.05% (Low)</option>
                <option value={3000}>0.3% (Standard)</option>
                <option value={10000}>1% (High)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Swap fee percentage</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-700 rounded">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Pool Pair:</span>
                <span className="text-white font-medium">
                  {selectedTokenInfo?.symbol || 'TOKEN'}/ETH
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Fee Tier:</span>
                <span className="text-white">{poolFee / 10000}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Initial Price:</span>
                <span className="text-white">
                  {poolTokenAmount && poolEthAmount
                    ? `1 ETH = ${(
                        Number(poolTokenAmount) / Number(poolEthAmount)
                      ).toFixed(2)} ${selectedTokenInfo?.symbol}`
                    : "Enter amounts"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={dexHash}
            disabled={
              !isConnected ||
              !poolTokenAmount ||
              !poolEthAmount ||
              dex.isCreatingPool
            }
            className="w-full mt-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 disabled:opacity-50 text-white py-3 px-4 rounded-lg transition-colors font-medium"
          >
            {dex.isCreatingPool ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating DEX Pool...
              </span>
            ) : (
              "Create DEX Pool on Uniswap"
            )}
          </button>
        </div>
      ) : (
        /* Pool exists - Show liquidity management */
        <div className="grid md:grid-cols-2 gap-6">
          {/* Add Liquidity to Existing Pool */}
          <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-4 border border-gray-700">
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
              💧 Add Liquidity
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">
                Pool Active
              </span>
            </h4>
            {dex.error && (
              <div className="text-red-400 text-sm mb-4 p-2 bg-red-900/30 border border-red-500/50 rounded">
                {dex.error}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-gray-300 text-sm mb-1">
                  Token Amount
                </label>
                <input
                  type="number"
                  value={liquidityAmount}
                  onChange={(e) => setLiquidityAmount(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
                  placeholder="10000"
                />
                <p className="text-xs text-gray-400 mt-1">Your {selectedTokenInfo?.symbol} tokens</p>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">
                  ETH Amount
                </label>
                <input
                  type="number"
                  value={ethAmount}
                  onChange={(e) => setEthAmount(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
                  placeholder="1.0"
                  step="0.01"
                />
                <p className="text-xs text-gray-400 mt-1">ETH to provide as liquidity</p>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Current Pool Ratio:</span>
                    <span className="text-white">~1 ETH : 12,340 {selectedTokenInfo?.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">LP Tokens to Receive:</span>
                    <span className="text-green-400">~0.05 LP</span>
                  </div>
                </div>
              </div>
              <button
                disabled={
                  !isConnected ||
                  !liquidityAmount ||
                  !ethAmount
                }
                onClick={async () => {
                  try {
                    await dex.addLiquidity(
                      liquidityAmount,
                      ethAmount,
                      poolFee
                    );
                  } catch (error) {
                    console.error("Error adding liquidity:", error);
                  }
                }}
                className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Add Liquidity
              </button>
            </div>
          </div>

          {/* Pool Information */}
          <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-4 border border-gray-700">
            <h4 className="text-lg font-semibold text-white mb-3">
              📊 Pool Information
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-300">Pool Status:</span>
                <span className="text-green-400 font-medium flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  Active
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Total Liquidity:</span>
                <span className="text-white font-medium">
                  Loading...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">My Position:</span>
                <span className="text-white font-medium">
                  No position
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Pool Share:</span>
                <span className="text-white font-medium">
                  0%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Fee Tier:</span>
                <span className="text-white font-medium">{poolFee / 10000}%</span>
              </div>
              <div className="pt-3 border-t border-gray-600">
                <button
                  disabled={!isConnected}
                  className="w-full bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white py-2 px-4 rounded-lg transition-colors mb-2"
                >
                  Remove Liquidity
                </button>
                <Link
                  href={`https://app.uniswap.org/pools/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <button className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 px-4 rounded-lg transition-colors">
                    View on Uniswap
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DEXPage = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'info' | 'buysell' | 'liquidity'>('create');
  const [selectedToken, setSelectedToken] = useState<Address | ''>('');
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  

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
    { id: 'liquidity' as const, label: 'Manage Liquidity', icon: '💧' },
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

      case 'liquidity':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Manage Liquidity</h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                Add or remove liquidity from existing pools to earn fees and support token trading.
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
                  Please connect your wallet to manage liquidity.
                </p>
              </div>
            )}
            
            {/* Liquidity Management Component */}
            {selectedToken && (
              <LiquidityManagerComponent tokenAddress={selectedToken as Address} />
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
