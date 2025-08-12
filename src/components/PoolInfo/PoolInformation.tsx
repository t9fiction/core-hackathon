import React, { useState, useEffect } from 'react';
import { Address, formatEther } from 'viem';
import { useChainId, useReadContract } from 'wagmi';
import { getContractAddresses } from '../../lib/contracts/addresses';
import { CHAINCRAFT_TOKEN_ABI } from '../../lib/contracts/abis';

// SushiSwap V2 Pair ABI (essential functions)
const SUSHISWAP_V2_PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { internalType: "uint112", name: "_reserve0", type: "uint112" },
      { internalType: "uint112", name: "_reserve1", type: "uint112" },
      { internalType: "uint32", name: "_blockTimestampLast", type: "uint32" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// SushiSwap V2 Factory ABI
const SUSHISWAP_V2_FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
    ],
    name: "getPair",
    outputs: [{ internalType: "address", name: "pair", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// SushiSwap V2 addresses on Core DAO
const SUSHISWAP_V2_ADDRESSES = {
  1116: { // Core DAO Mainnet
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763",
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",
  },
  1114: { // Core DAO Testnet2
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763",
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",
  }
};

interface PoolData {
  tokenAddress: string;
  ethAddress: string;
  pairAddress: string | null;
  poolStats: {
    reserve0: string; // First token reserve
    reserve1: string; // Second token reserve
    totalSupply: string; // LP token supply
    token0: string; // First token address
    token1: string; // Second token address
    price: string; // Calculated price
    liquidity: string; // Total liquidity in USD equivalent
    isActive: boolean;
  } | null;
  hasActivePool: boolean;
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
  const contractAddresses = getContractAddresses(chainId);
  const sushiV2Addresses = SUSHISWAP_V2_ADDRESSES[chainId as keyof typeof SUSHISWAP_V2_ADDRESSES];
  const WETH_ADDRESS = contractAddresses.WETH;

  // Get SushiSwap pair address
  const { data: pairAddress, isLoading: loadingPair } = useReadContract({
    address: sushiV2Addresses?.factory as Address,
    abi: SUSHISWAP_V2_FACTORY_ABI,
    functionName: "getPair",
    args: [tokenAddress!, WETH_ADDRESS as Address],
    query: { enabled: !!(tokenAddress && WETH_ADDRESS && sushiV2Addresses?.factory) }
  });

  const pairExists = pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000";

  // Get pair reserves (liquidity info)
  const { data: reserves, isLoading: loadingReserves } = useReadContract({
    address: pairAddress as Address,
    abi: SUSHISWAP_V2_PAIR_ABI,
    functionName: "getReserves",
    query: { enabled: !!pairExists }
  });

  // Get LP token total supply
  const { data: totalSupply, isLoading: loadingSupply } = useReadContract({
    address: pairAddress as Address,
    abi: SUSHISWAP_V2_PAIR_ABI,
    functionName: "totalSupply",
    query: { enabled: !!pairExists }
  });

  // Get token0 and token1 addresses to determine order
  const { data: token0, isLoading: loadingToken0 } = useReadContract({
    address: pairAddress as Address,
    abi: SUSHISWAP_V2_PAIR_ABI,
    functionName: "token0",
    query: { enabled: !!pairExists }
  });

  const { data: token1, isLoading: loadingToken1 } = useReadContract({
    address: pairAddress as Address,
    abi: SUSHISWAP_V2_PAIR_ABI,
    functionName: "token1",
    query: { enabled: !!pairExists }
  });

  // Get token decimals and total supply for market cap calculation
  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: "decimals",
    query: { enabled: !!tokenAddress }
  });

  const { data: tokenTotalSupply } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: "totalSupply",
    query: { enabled: !!tokenAddress }
  });

  const loading = loadingPair || loadingReserves || loadingSupply || loadingToken0 || loadingToken1;

  // Process pool data when all requests complete
  useEffect(() => {
    if (!tokenAddress || loading) return;

    let processedPoolStats = null;
    
    if (pairExists && reserves && totalSupply && token0 && token1) {
      // Determine which token is which based on addresses
      const isTokenFirst = tokenAddress.toLowerCase() === (token0 as string).toLowerCase();
      
      const reserve0 = reserves[0].toString();
      const reserve1 = reserves[1].toString();
      
      const tokenReserve = isTokenFirst ? reserve0 : reserve1;
      const ethReserve = isTokenFirst ? reserve1 : reserve0;
      
      // Calculate price (ETH per token)
      let price = '0';
      if (tokenReserve !== '0' && ethReserve !== '0') {
        const ethReserveBig = BigInt(ethReserve);
        const tokenReserveBig = BigInt(tokenReserve);
        price = formatEther((ethReserveBig * 10n**18n) / tokenReserveBig);
      }
      
      // Calculate total liquidity (in ETH equivalent)
      const liquidityETH = formatEther(BigInt(ethReserve) * 2n); // Double ETH reserve for total liquidity
      
      processedPoolStats = {
        reserve0,
        reserve1,
        totalSupply: totalSupply.toString(),
        token0: token0 as string,
        token1: token1 as string,
        price,
        liquidity: liquidityETH,
        isActive: true,
      };
    }

    const newPoolData: PoolData = {
      tokenAddress: tokenAddress as string,
      ethAddress: WETH_ADDRESS,
      pairAddress: pairExists ? (pairAddress as string) : null,
      poolStats: processedPoolStats,
      hasActivePool: !!pairExists,
    };

    setPoolData(newPoolData);
    setLastUpdated(new Date());
  }, [tokenAddress, pairAddress, reserves, totalSupply, token0, token1, pairExists, loading, WETH_ADDRESS]);

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

  // Calculate market cap if we have token supply and price
  const calculateMarketCap = () => {
    if (!poolData?.poolStats?.price || !tokenTotalSupply) return '0';
    const price = parseFloat(poolData.poolStats.price);
    const supply = parseFloat(formatEther(tokenTotalSupply as bigint));
    return (price * supply).toString();
  };

  // Check if SushiSwap is available on this network
  if (!sushiV2Addresses) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6">
        <h4 className="text-red-300 font-semibold mb-2">SushiSwap Not Available</h4>
        <p className="text-red-200 text-sm">
          SushiSwap V2 is not available on this network (Chain ID: {chainId}).
        </p>
      </div>
    );
  }

  if (!tokenAddress) {
    return (
      <div className="bg-gray-700 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <span className="text-blue-400 mr-2">🍣</span>
          SushiSwap Pool Information
        </h4>
        <div className="text-center py-12">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Token Selected</h3>
          <p className="text-gray-400 text-sm">
            Please select a token to view its SushiSwap pool information and trading statistics.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !poolData) {
    return (
      <div className="bg-gray-700 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <span className="text-blue-400 mr-2">🍣</span>
          SushiSwap Pool Information
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
          <span className="ml-2 text-gray-300">Loading SushiSwap pool data...</span>
        </div>
      </div>
    );
  }


  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-white flex items-center">
          <span className="text-blue-400 mr-2">🍣</span>
          SushiSwap Pool Information
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
          {poolData.poolStats && (
            <div className="bg-gradient-to-r from-gray-600/80 to-gray-600/60 backdrop-blur-sm rounded-lg p-6 border border-gray-500/30">
              <div className="flex items-center mb-4">
                <div className="bg-blue-500/20 p-2 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h5 className="text-white font-semibold text-lg">SushiSwap Pool Statistics</h5>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-black/20 rounded-lg p-4 border border-gray-500/20">
                  <div className="text-gray-300 text-sm mb-1 flex items-center">
                    <span className="text-green-400 mr-2">💰</span>
                    Token Price (ETH)
                  </div>
                  <div className="text-white font-bold text-lg">
                    {parseFloat(poolData.poolStats.price) > 0 ? 
                      `${parseFloat(poolData.poolStats.price).toFixed(6)} ETH` : 
                      'N/A'
                    }
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-gray-500/20">
                  <div className="text-gray-300 text-sm mb-1 flex items-center">
                    <span className="text-purple-400 mr-2">📊</span>
                    Market Cap
                  </div>
                  <div className="text-white font-bold text-lg">
                    {tokenTotalSupply ? 
                      formatCurrency(calculateMarketCap(), '$') : 
                      'N/A'
                    }
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-gray-500/20">
                  <div className="text-gray-300 text-sm mb-1 flex items-center">
                    <span className="text-cyan-400 mr-2">💧</span>
                    Total Liquidity
                  </div>
                  <div className="text-white font-bold text-lg">
                    {formatCurrency(poolData.poolStats.liquidity, '')} ETH
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 border border-gray-500/20">
                  <div className="text-gray-300 text-sm mb-1 flex items-center">
                    <span className="text-blue-400 mr-2">📈</span>
                    Fee Tier
                  </div>
                  <div className="text-white font-bold text-lg">
                    0.3% (SushiSwap V2)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Pool */}
          {poolData.hasActivePool && poolData.poolStats ? (
            <div className="space-y-3">
              <h5 className="text-white font-medium">SushiSwap Pool Details</h5>
              <div className="bg-gray-600 rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">
                    {tokenSymbol}/CORE - SushiSwap V2 (0.3%)
                  </span>
                  <span className="text-green-400 text-sm">● Active</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-300">💧 {tokenSymbol} Reserve: </span>
                      <span className="text-white font-medium">
                        {(() => {
                          const isTokenFirst = tokenAddress.toLowerCase() === poolData.poolStats.token0.toLowerCase();
                          const tokenReserve = isTokenFirst ? poolData.poolStats.reserve0 : poolData.poolStats.reserve1;
                          return formatTokenAmount(tokenReserve);
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-300">💧 CORE Reserve: </span>
                      <span className="text-white font-medium">
                        {(() => {
                          const isTokenFirst = tokenAddress.toLowerCase() === poolData.poolStats.token0.toLowerCase();
                          const coreReserve = isTokenFirst ? poolData.poolStats.reserve1 : poolData.poolStats.reserve0;
                          return formatTokenAmount(coreReserve);
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-300">🎯 LP Tokens: </span>
                      <span className="text-white">{formatTokenAmount(poolData.poolStats.totalSupply)}</span>
                    </div>
                    <div>
                      <span className="text-gray-300">🔗 Pair Address: </span>
                      <span className="text-white text-xs font-mono">
                        {poolData.pairAddress?.slice(0, 6)}...{poolData.pairAddress?.slice(-4)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Pool Links */}
                <div className="mt-3 pt-2 border-t border-gray-500">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">External Links:</span>
                    <div className="space-x-2">
                      <a 
                        href={`https://scan.coredao.org/address/${poolData.pairAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        View on CoreScan
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg p-6 text-center">
              <div className="mb-3">
                <svg className="mx-auto h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h4 className="text-yellow-400 font-medium mb-2">No SushiSwap Pool Available</h4>
              <p className="text-gray-300 text-sm mb-4">
                This token doesn&apos;t have a SushiSwap pool yet. Trading is not currently enabled.
              </p>
              <p className="text-gray-400 text-xs">
                💡 Create a SushiSwap pool to enable decentralized trading for this token
              </p>
            </div>
          )}

          {/* Pool Status */}
          <div className="bg-gray-600 rounded p-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">SushiSwap Pool Status:</span>
              <span className={`font-medium ${poolData.hasActivePool ? 'text-green-400' : 'text-yellow-400'}`}>
                {poolData.hasActivePool ? '✅ Pool Active' : '⚠️ No Pool'}
              </span>
            </div>
            {poolData.hasActivePool && (
              <div className="mt-2 text-xs text-gray-400">
                Trading enabled on SushiSwap V2 with 0.3% fee
              </div>
            )}
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
          <h3 className="text-lg font-medium text-white mb-2">Unable to Load SushiSwap Data</h3>
          <p className="text-gray-400 text-sm">
            We couldn&apos;t retrieve SushiSwap pool information for this token. Please try again or check if the token address is valid.
          </p>
        </div>
      )}
    </div>
  );
};

export default PoolInformation;
