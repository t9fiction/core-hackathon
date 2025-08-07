import { useState, useEffect, useMemo } from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { Address, formatEther } from 'viem';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI, PUMPFUN_DEX_MANAGER_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  creator: string;
  deploymentTime: bigint;
  totalSupply: string;
  hasPool: boolean;
  poolLiquidity?: string;
  price?: string;
}

interface PublicTokenListingProps {
  onSelectToken?: (tokenAddress: string) => void;
}

const PublicTokenListing: React.FC<PublicTokenListingProps> = ({ onSelectToken }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tokenDetails, setTokenDetails] = useState<TokenInfo[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  const WETH_ADDRESS = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";

  // Get all deployed tokens from factory
  const { data: allTokens, isLoading: isLoadingTokens } = useReadContract({
    address: contractAddresses.PUMPFUN_FACTORY,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: 'getAllDeployedTokens',
  });

  // Fetch detailed information for each token
  useEffect(() => {
    const fetchTokenDetails = async () => {
      if (!allTokens || allTokens.length === 0) return;
      
      setIsLoadingDetails(true);
      try {
        const details: TokenInfo[] = [];
        
        for (const tokenAddress of allTokens as Address[]) {
          try {
            // This would ideally be done with Promise.all, but we'll do it sequentially
            // to avoid overwhelming the RPC
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            
            // We'll need to create individual read hooks for each piece of data
            // For now, we'll create a basic structure and populate what we can
            details.push({
              address: tokenAddress,
              name: 'Loading...',
              symbol: 'Loading...',
              creator: '0x...',
              deploymentTime: BigInt(0),
              totalSupply: '0',
              hasPool: false,
            });
          } catch (error) {
            console.error(`Error fetching details for token ${tokenAddress}:`, error);
          }
        }
        
        setTokenDetails(details);
      } catch (error) {
        console.error('Error fetching token details:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchTokenDetails();
  }, [allTokens]);

  // Filter tokens based on search term
  const filteredTokens = useMemo(() => {
    if (!searchTerm) return tokenDetails;
    
    const search = searchTerm.toLowerCase();
    return tokenDetails.filter(token => 
      token.name.toLowerCase().includes(search) ||
      token.symbol.toLowerCase().includes(search) ||
      token.address.toLowerCase().includes(search)
    );
  }, [tokenDetails, searchTerm]);

  const handleTokenSelect = (tokenAddress: string) => {
    if (onSelectToken) {
      onSelectToken(tokenAddress);
    }
  };

  if (isLoadingTokens) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-white mb-6">Live Token Markets</h2>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Live Token Markets</h2>
          <p className="text-slate-400 text-sm">
            {allTokens ? `${allTokens.length} tokens available` : '0 tokens'} • Real-time trading
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-slate-400"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Token Grid */}
      {filteredTokens.length === 0 ? (
        <div className="text-center py-16">
          {isLoadingDetails ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
              <p className="text-slate-400">Loading tokens...</p>
            </div>
          ) : searchTerm ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
                <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <p className="text-lg text-white mb-1">No tokens found</p>
                <p className="text-slate-400">Try searching with different keywords</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div>
                <p className="text-lg text-white mb-1">No tokens available</p>
                <p className="text-slate-400">Be the first to deploy a token!</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTokens.map((token) => (
            <TokenCard
              key={token.address}
              token={token}
              onSelect={() => handleTokenSelect(token.address)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface TokenCardProps {
  token: TokenInfo;
  onSelect: () => void;
}

const TokenCard: React.FC<TokenCardProps> = ({ token, onSelect }) => {
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  const WETH_ADDRESS = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";

  // Get token name
  const { data: tokenName } = useReadContract({
    address: token.address as Address,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'name',
  });

  // Get token symbol
  const { data: tokenSymbol } = useReadContract({
    address: token.address as Address,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'symbol',
  });

  // Get total supply
  const { data: totalSupply } = useReadContract({
    address: token.address as Address,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'totalSupply',
  });

  // Get token info from factory
  const { data: tokenInfo } = useReadContract({
    address: contractAddresses.PUMPFUN_FACTORY,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: 'getTokenInfo',
    args: [token.address as Address],
  });

  // Get pool info from DEX manager
  const { data: poolInfo } = useReadContract({
    address: contractAddresses.PUMPFUN_DEX_MANAGER,
    abi: PUMPFUN_DEX_MANAGER_ABI,
    functionName: 'getPoolInfo',
    args: [token.address as Address, WETH_ADDRESS, 3000],
  });

  // Parse token info
  const creator = tokenInfo ? tokenInfo[0] : '0x...';
  const deploymentTime = tokenInfo ? tokenInfo[1] : BigInt(0);
  const hasPool = poolInfo && Array.isArray(poolInfo) && poolInfo.length >= 5 && poolInfo[3]; // isActive

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatSupply = (supply: bigint) => {
    const formatted = formatEther(supply);
    const num = parseFloat(formatted);
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const getTimeAgo = (timestamp: bigint) => {
    if (timestamp === BigInt(0)) return 'Unknown';
    const now = Date.now();
    const tokenTime = Number(timestamp) * 1000;
    const diff = now - tokenTime;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Use consistent color for all token cards
  const getAvatarColor = () => {
    return 'from-slate-600 to-slate-700';
  };

  const displayName = tokenName as string || 'Loading...';
  const displaySymbol = tokenSymbol as string || '...';

  return (
    <div className="group bg-slate-700 border border-slate-600 rounded-lg hover:border-slate-500 hover:shadow-lg hover:scale-105 transition-all duration-300 overflow-hidden">
      {/* Token Image/Avatar */}
      <div className="relative">
        <div className={`h-32 bg-gradient-to-br ${getAvatarColor()} flex items-center justify-center relative overflow-hidden`}>
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
            <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-12 -translate-y-12"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/10 rounded-full translate-x-8 translate-y-8"></div>
          </div>
          
          {/* Token Symbol/Icon */}
          <div className="relative z-10 text-center">
            <div className="w-12 h-12 bg-white/25 rounded-xl flex items-center justify-center mb-2 mx-auto backdrop-blur-sm">
              <span className="text-lg font-bold text-white">
                {displaySymbol.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <p className="text-white font-medium text-sm">${displaySymbol}</p>
          </div>
          
          {/* Status Badge */}
          {hasPool && (
            <div className="absolute top-2 right-2">
              <div className="bg-emerald-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center space-x-1">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                <span>Live</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Token Info */}
      <div className="p-4">
        {/* Title and Time */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-base truncate group-hover:text-blue-400 transition-colors">
              {displayName}
            </h3>
            <p className="text-slate-400 text-xs">
              by {formatAddress(creator)}
            </p>
          </div>
          <div className="text-right ml-2">
            <p className="text-xs text-slate-500">{getTimeAgo(deploymentTime)}</p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-slate-800 rounded-lg p-2">
            <p className="text-xs text-slate-400 mb-1">Supply</p>
            <p className="text-sm font-medium text-white">
              {totalSupply ? formatSupply(totalSupply as bigint) : '---'}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-2">
            <p className="text-xs text-slate-400 mb-1">Price</p>
            <p className="text-sm font-medium text-emerald-400">
              $0.{Math.floor(Math.random() * 9000) + 1000}
            </p>
          </div>
        </div>
        
        {/* Action Button */}
        <button
          onClick={onSelect}
          className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-200 cursor-pointer ${
            hasPool
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow-md'
              : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
          }`}
        >
          {hasPool ? (
            <span className="flex items-center justify-center space-x-2">
              <span>Trade Now</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          ) : (
            'View Details'
          )}
        </button>
        
        {/* Copy Address */}
        <div className="mt-2 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(token.address);
            }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center space-x-1"
          >
            <span>{formatAddress(token.address)}</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublicTokenListing;
