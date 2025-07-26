import React, { useState, useEffect } from 'react';
import { Address } from 'viem';
import { useChainId, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES as ADDRESSES } from "../../lib/contracts/addresses"
import { PUMPFUN_DEX_MANAGER_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';

interface PoolData {
  tokenAddress: string;
  ethAddress: string;
  pools: Array<{
    fee: number;
    tokenId: string;
    liquidity: string;
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

  // Get pool info for different fee tiers
  const { data: poolInfo500, isLoading: loading500 } = useReadContract({
    address: contractAddresses?.PUMPFUN_DEX_MANAGER as Address,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: "getPoolInfo",
    args: [tokenAddress!, WETH_ADDRESS as Address, 500],
    query: { enabled: !!tokenAddress && !!contractAddresses?.PUMPFUN_DEX_MANAGER }
  });

  const { data: poolInfo3000, isLoading: loading3000 } = useReadContract({
    address: contractAddresses?.PUMPFUN_DEX_MANAGER as Address,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: "getPoolInfo",
    args: [tokenAddress!, WETH_ADDRESS as Address, 3000],
    query: { enabled: !!tokenAddress && !!contractAddresses?.PUMPFUN_DEX_MANAGER }
  });

  const { data: poolInfo10000, isLoading: loading10000 } = useReadContract({
    address: contractAddresses?.PUMPFUN_DEX_MANAGER as Address,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: "getPoolInfo",
    args: [tokenAddress!, WETH_ADDRESS as Address, 10000],
    query: { enabled: !!tokenAddress && !!contractAddresses?.PUMPFUN_DEX_MANAGER }
  });

  // Get token stats
  const { data: tokenStats, isLoading: loadingStats } = useReadContract({
    address: contractAddresses?.PUMPFUN_DEX_MANAGER as Address,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: "getTokenStats",
    args: [tokenAddress!],
    query: { enabled: !!tokenAddress && !!contractAddresses?.PUMPFUN_DEX_MANAGER }
  });

  // Check if token is authorized
  const { data: isAuthorized, isLoading: loadingAuth } = useReadContract({
    address: contractAddresses?.PUMPFUN_DEX_MANAGER as Address,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: "authorizedTokens",
    args: [tokenAddress!],
    query: { enabled: !!tokenAddress && !!contractAddresses?.PUMPFUN_DEX_MANAGER }
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
      if (data && Array.isArray(data) && data.length >= 5 && data[3]) { // isActive is at index 3
        pools.push({
          fee,
          tokenId: data[0]?.toString() || '0',
          liquidity: data[1]?.toString() || '0',
          lockExpiry: data[2]?.toString() || '0',
          isActive: Boolean(data[3]),
          createdAt: data[4]?.toString() || '0',
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

  const formatCurrency = (value: string, symbol: string = '$') => {
    const num = parseFloat(value || '0');
    if (num === 0) return `${symbol}0`;
    if (num < 0.001) return `< ${symbol}0.001`;
    if (num < 1) return `${symbol}${num.toFixed(4)}`;
    if (num < 1000) return `${symbol}${num.toFixed(2)}`;
    if (num < 1000000) return `${symbol}${(num / 1000).toFixed(1)}K`;
    return `${symbol}${(num / 1000000).toFixed(1)}M`;
  };

  const formatTokenAmount = (value: string) => {
    const num = parseFloat(value || '0');
    if (num === 0) return '0';
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
        <div className="text-center text-gray-400 py-8">
          Select a token to view pool information
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
            <div className="bg-gray-600 rounded p-4">
              <h5 className="text-white font-medium mb-3">Token Statistics</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-300 text-sm">Price</div>
                  <div className="text-white font-bold">
                    {formatCurrency(poolData.tokenStats.price)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-300 text-sm">Market Cap</div>
                  <div className="text-white font-bold">
                    {formatCurrency(poolData.tokenStats.marketCap)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-300 text-sm">24h Volume</div>
                  <div className="text-white font-bold">
                    {formatCurrency(poolData.tokenStats.volume24h)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-300 text-sm">Total Liquidity</div>
                  <div className="text-white font-bold">
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
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-300">Liquidity: </span>
                      <span className="text-white">{formatTokenAmount(pool.liquidity)}</span>
                    </div>
                    <div>
                      <span className="text-gray-300">Created: </span>
                      <span className="text-white">
                        {new Date(parseInt(pool.createdAt) * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-600 rounded p-4 text-center">
              <div className="text-gray-300 mb-2">No Active Pools</div>
              <div className="text-gray-400 text-sm">
                Create a DEX pool to enable trading for this token
              </div>
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
        <div className="text-center text-gray-400 py-8">
          No pool data available
        </div>
      )}
    </div>
  );
};

export default PoolInformation;
