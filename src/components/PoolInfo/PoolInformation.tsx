import React, { useState, useEffect } from 'react';
import { Address, formatEther } from 'viem';
import { useChainId, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES as ADDRESSES } from "../../lib/contracts/addresses"
import { CHAINCRAFT_DEX_MANAGER_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';

interface PoolData {
  tokenAddress: string;
  ethAddress: string;
  pools: Array<{
    fee: number;
    tokenId: string;
    liquidity: string;
    amount0: string; // Actual token amount locked
    amount1: string; // Actual ETH amount locked
    lockExpiry: string;
    isActive: boolean;
    createdAt: string;
  }>;
  tokenStats: {
    price: string;
    marketCap: string;
    volume24h: string;
    liquidity: string;
    isActive: boolean;
  } | null;
  isAuthorized: boolean;
  hasActivePools: boolean;
}

interface PoolInformationProps {
  tokenAddress?: Address;
  tokenSymbol?: string;
  refreshTrigger?: number;
}

const PoolInformation: React.FC<PoolInformationProps> = ({ 
  tokenAddress, 
  tokenSymbol = 'TOKEN',
  refreshTrigger = 0
}) => {
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const chainId = useChainId();
  const addresses = ADDRESSES[chainId];
  const contractAddresses = getContractAddresses(chainId);
  const WETH_ADDRESS = addresses?.WETH || "0xfff9976782d46cc05630d1f6ebab18b2324d6b14"; // fallback to Sepolia WETH

  // Get detailed pool info for different fee tiers
  const { data: poolInfo500, isLoading: loading500 } = useReadContract({
    address: contractAddresses?.CHAINCRAFT_DEX_MANAGER as Address,
    abi: CHAINCRAFT_DEX_MANAGER_ABI,
    functionName: "getDetailedPoolInfo",
    args: [tokenAddress!, WETH_ADDRESS as Address, 500],
    query: { enabled: !!tokenAddress && !!contractAddresses?.CHAINCRAFT_DEX_MANAGER }
  });

  const { data: poolInfo3000, isLoading: loading3000 } = useReadContract({
    address: contractAddresses?.CHAINCRAFT_DEX_MANAGER as Address,
    abi: CHAINCRAFT_DEX_MANAGER_ABI,
    functionName: "getDetailedPoolInfo",
    args: [tokenAddress!, WETH_ADDRESS as Address, 3000],
    query: { enabled: !!tokenAddress && !!contractAddresses?.CHAINCRAFT_DEX_MANAGER }
  });

  const { data: poolInfo10000, isLoading: loading10000 } = useReadContract({
    address: contractAddresses?.CHAINCRAFT_DEX_MANAGER as Address,
    abi: CHAINCRAFT_DEX_MANAGER_ABI,
    functionName: "getDetailedPoolInfo",
    args: [tokenAddress!, WETH_ADDRESS as Address, 10000],
    query: { enabled: !!tokenAddress && !!contractAddresses?.CHAINCRAFT_DEX_MANAGER }
  });

  // Get token stats
  const { data: tokenStats, isLoading: loadingStats } = useReadContract({
    address: contractAddresses?.CHAINCRAFT_DEX_MANAGER as Address,
    abi: CHAINCRAFT_DEX_MANAGER_ABI,
    functionName: "getTokenStats",
    args: [tokenAddress!],
    query: { enabled: !!tokenAddress && !!contractAddresses?.CHAINCRAFT_DEX_MANAGER }
  });

  // Check if token is authorized
  const { data: isAuthorized, isLoading: loadingAuth } = useReadContract({
    address: contractAddresses?.CHAINCRAFT_DEX_MANAGER as Address,
    abi: CHAINCRAFT_DEX_MANAGER_ABI,
    functionName: "authorizedTokens",
    args: [tokenAddress!],
    query: { enabled: !!tokenAddress && !!contractAddresses?.CHAINCRAFT_DEX_MANAGER }
  });

  const loading = loading500 || loading3000 || loading10000 || loadingStats || loadingAuth;

  // Process pool data when all requests complete
  useEffect(() => {
    if (!tokenAddress || loading) return;

    const pools: PoolData['pools'] = [];
    const feesTiers = [
      { fee: 500, data: poolInfo500 },
      { fee: 3000, data: poolInfo3000 },
      { fee: 10000, data: poolInfo10000 }
    ];

    feesTiers.forEach(({ fee, data }) => {
      if (data && Array.isArray(data) && data.length >= 7 && data[5]) { // isActive is now at index 5
        // For detailed pool info: [tokenId, liquidity, amount0, amount1, lockExpiry, isActive, createdAt]
        const isTokenFirst = tokenAddress && tokenAddress.toLowerCase() < WETH_ADDRESS.toLowerCase();
        
        pools.push({
          fee,
          tokenId: data[0]?.toString() || '0',
          liquidity: data[1]?.toString() || '0',
          amount0: data[2]?.toString() || '0', // First token amount
          amount1: data[3]?.toString() || '0', // Second token amount  
          lockExpiry: data[4]?.toString() || '0',
          isActive: Boolean(data[5]),
          createdAt: data[6]?.toString() || '0',
        });
      }
    });

    let processedTokenStats = null;
    if (tokenStats && Array.isArray(tokenStats) && tokenStats.length >= 5) {
      processedTokenStats = {
        price: tokenStats[0]?.toString() || '0',
        marketCap: tokenStats[1]?.toString() || '0',
        volume24h: tokenStats[2]?.toString() || '0',
        liquidity: tokenStats[3]?.toString() || '0',
        isActive: Boolean(tokenStats[4]),
      };
    }

    const newPoolData: PoolData = {
      tokenAddress: tokenAddress as string,
      ethAddress: WETH_ADDRESS,
      pools,
      tokenStats: processedTokenStats,
      isAuthorized: Boolean(isAuthorized),
      hasActivePools: pools.length > 0,
    };

    setPoolData(newPoolData);
    setLastUpdated(new Date());
  }, [tokenAddress, poolInfo500, poolInfo3000, poolInfo10000, tokenStats, isAuthorized, loading, WETH_ADDRESS]);

  const formatCurrency = (value: string | bigint, symbol: string = '$') => {
    let num: number;
    if (typeof value === 'bigint') {
      num = parseFloat(formatEther(value));
    } else {
      // Try to parse as wei first, then as normal number
      try {
        const bigIntValue = BigInt(value || '0');
        num = parseFloat(formatEther(bigIntValue));
      } catch {
        num = parseFloat(value || '0');
      }
    }
    
    if (num === 0) return `${symbol}0.00`;
    if (num < 0.000001) return `< ${symbol}0.000001`;
    if (num < 0.01) return `${symbol}${num.toFixed(6)}`;
    if (num < 1) return `${symbol}${num.toFixed(4)}`;
    if (num < 1000) return `${symbol}${num.toFixed(2)}`;
    if (num < 1000000) return `${symbol}${(num / 1000).toFixed(1)}K`;
    if (num < 1000000000) return `${symbol}${(num / 1000000).toFixed(1)}M`;
    return `${symbol}${(num / 1000000000).toFixed(1)}B`;
  };

  const formatTokenAmount = (value: string | bigint) => {
    let num: number;
    if (typeof value === 'bigint') {
      num = parseFloat(formatEther(value));
    } else {
      // Try to parse as wei first, then as normal number
      try {
        const bigIntValue = BigInt(value || '0');
        num = parseFloat(formatEther(bigIntValue));
      } catch {
        num = parseFloat(value || '0');
      }
    }
    
    if (num === 0) return '0.00';
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
    return `${(num / 1000000000).toFixed(1)}B`;
  };

  const getFeeTierLabel = (fee: number) => {
    switch (fee) {
      case 500: return '0.05%';
      case 3000: return '0.3%';
      case 10000: return '1%';
      default: return `${fee / 10000}%`;
    }
  };

  if (!tokenAddress) {
    return (
      <div className="bg-gray-700 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4">
          💧 Pool Information
        </h4>
        <div className="text-center py-12">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Token Selected</h3>
          <p className="text-gray-400 text-sm">
            Please select a token to view its pool information and trading statistics.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !poolData) {
    return (
      <div className="bg-gray-700 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4">
          💧 Pool Information
        </h4>
        <div className="flex items-center justify-center py-8">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
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
          <span className="ml-2 text-gray-300">Loading pool data...</span>
        </div>
      </div>
    );
  }


  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-white">
          💧 Pool Information
        </h4>
        <div className="flex items-center space-x-2">
          {loading && (
            <svg
              className="animate-spin h-4 w-4 text-blue-500"
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
          )}
        </div>
      </div>

      {poolData ? (
        <div className="space-y-4">
          {/* Token Stats */}
          {poolData.tokenStats && (
            <div className="bg-gradient-to-r from-gray-600/80 to-gray-600/60 backdrop-blur-sm rounded-lg p-6 border border-gray-500/30">
              <div className="flex items-center mb-4">
                <div className="bg-blue-500/20 p-2 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h5 className="text-white font-semibold text-lg">Token Statistics</h5>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-black/20 rounded-lg p-4 border border-gray-500/20">
                  <div className="text-gray-300 text-sm mb-1 flex items-center">
                    <span className="text-green-400 mr-2">💰</span>
                    Token Price
                  </div>
                  <div className="text-white font-bold text-lg">
                    {formatCurrency(poolData.tokenStats.price)}
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-gray-500/20">
                  <div className="text-gray-300 text-sm mb-1 flex items-center">
                    <span className="text-purple-400 mr-2">📊</span>
                    Market Cap
                  </div>
                  <div className="text-white font-bold text-lg">
                    {formatCurrency(BigInt(poolData.tokenStats.marketCap) / (10n ** 18n))}
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-gray-500/20">
                  <div className="text-gray-300 text-sm mb-1 flex items-center">
                    <span className="text-blue-400 mr-2">📈</span>
                    24h Volume
                  </div>
                  <div className="text-white font-bold text-lg">
                    {formatCurrency(poolData.tokenStats.volume24h)}
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-gray-500/20">
                  <div className="text-gray-300 text-sm mb-1 flex items-center">
                    <span className="text-cyan-400 mr-2">💧</span>
                    Total Liquidity
                  </div>
                  <div className="text-white font-bold text-lg">
                    {formatCurrency(poolData.tokenStats.liquidity)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Pools */}
          {poolData.hasActivePools ? (
            <div className="space-y-3">
              <h5 className="text-white font-medium">Active Pools</h5>
              {poolData.pools.map((pool, index) => (
                <div key={index} className="bg-gray-600 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">
                      {tokenSymbol}/ETH - {getFeeTierLabel(pool.fee)}
                    </span>
                    <span className="text-green-400 text-sm">● Active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div>
                        <span className="text-gray-300">🔒 Locked {tokenSymbol}: </span>
                        <span className="text-white font-medium">
                          {(() => {
                            const isTokenFirst = tokenAddress && tokenAddress.toLowerCase() < WETH_ADDRESS.toLowerCase();
                            const tokenAmount = isTokenFirst ? pool.amount0 : pool.amount1;
                            return formatTokenAmount(tokenAmount);
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-300">🔒 Locked ETH: </span>
                        <span className="text-white font-medium">
                          {(() => {
                            const isTokenFirst = tokenAddress && tokenAddress.toLowerCase() < WETH_ADDRESS.toLowerCase();
                            const ethAmount = isTokenFirst ? pool.amount1 : pool.amount0;
                            return formatTokenAmount(ethAmount);
                          })()}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-gray-300">Liquidity: </span>
                        <span className="text-white">{formatTokenAmount(pool.liquidity)}</span>
                      </div>
                      <div>
                        <span className="text-gray-300">Created: </span>
                        <span className="text-white text-xs">
                          {new Date(parseInt(pool.createdAt) * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Permanent Lock Information */}
                  <div className="mt-3 pt-2 border-t border-gray-500">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Liquidity Status:</span>
                      <span className="font-medium text-amber-400 flex items-center">
                        <span className="mr-1">🔒</span>
                        Permanently Locked (Roach Motel)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg p-6 text-center">
              <div className="mb-3">
                <svg className="mx-auto h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h4 className="text-yellow-400 font-medium mb-2">No Trading Pools Available</h4>
              <p className="text-gray-300 text-sm mb-4">
                This token doesn&apos;t have any active liquidity pools yet. Trading is not currently enabled.
              </p>
              <p className="text-gray-400 text-xs">
                💡 Create a DEX pool to enable decentralized trading for this token
              </p>
            </div>
          )}

          {/* Authorization Status */}
          <div className="bg-gray-600 rounded p-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">DEX Authorization:</span>
              <span className={`font-medium ${poolData.isAuthorized ? 'text-green-400' : 'text-yellow-400'}`}>
                {poolData.isAuthorized ? '✅ Authorized' : '⚠️ Pending'}
              </span>
            </div>
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <div className="text-xs text-gray-400 text-center">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Unable to Load Pool Data</h3>
          <p className="text-gray-400 text-sm">
            We couldn&apos;t retrieve pool information for this token. Please try again or check if the token address is valid.
          </p>
        </div>
      )}
    </div>
  );
};

export default PoolInformation;
