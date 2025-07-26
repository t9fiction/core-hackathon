import React, { useState, useEffect } from 'react';
import { Address } from 'viem';
import { useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES as ADDRESSES } from "../../lib/contracts/addresses"

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const chainId = useChainId();
  const addresses = ADDRESSES[chainId];
  const WETH_ADDRESS = addresses?.WETH || "0xfff9976782d46cc05630d1f6ebab18b2324d6b14"; // fallback to Sepolia WETH

  const fetchPoolData = async () => {
    if (!tokenAddress) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/pool-info?tokenAddress=${tokenAddress}&ethAddress=${WETH_ADDRESS}&chainId=${chainId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch pool data: ${response.status}`);
      }

      const data = await response.json();
      setPoolData(data);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error fetching pool data:', error);
      setError(error.message || 'Failed to fetch pool information');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on mount and when tokenAddress changes
  useEffect(() => {
    fetchPoolData();
  }, [tokenAddress]);

  // Refresh data when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchPoolData();
    }
  }, [refreshTrigger]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!tokenAddress) return;

    const interval = setInterval(fetchPoolData, 30000);
    return () => clearInterval(interval);
  }, [tokenAddress]);

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

  if (error) {
    return (
      <div className="bg-gray-700 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4">
          💧 Pool Information
        </h4>
        <div className="text-center py-8">
          <div className="text-red-400 mb-4">⚠️ {error}</div>
          <button
            onClick={fetchPoolData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
          >
            Retry
          </button>
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
          <button
            onClick={fetchPoolData}
            className="text-blue-400 hover:text-blue-300 text-sm"
            disabled={loading}
          >
            🔄 Refresh
          </button>
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
