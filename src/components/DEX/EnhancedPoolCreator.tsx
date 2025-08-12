import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { Address, formatEther } from 'viem';
import ImprovedPoolManager from './ImprovedPoolManager';
import { CHAINCRAFT_FACTORY_ABI, CHAINCRAFT_TOKEN_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
}

interface EnhancedPoolCreatorProps {
  selectedTokenAddress?: Address;
  onPoolCreated?: (poolInfo: any) => void;
  showTokenSelection?: boolean;
}

const EnhancedPoolCreator: React.FC<EnhancedPoolCreatorProps> = ({
  selectedTokenAddress,
  onPoolCreated,
  showTokenSelection = true,
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  const [selectedToken, setSelectedToken] = useState<Address | undefined>(selectedTokenAddress);
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState('TOKEN');
  const [userTokens, setUserTokens] = useState<TokenInfo[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch user's deployed tokens
  const { data: tokenAddresses } = useReadContract({
    address: contractAddresses?.CHAINCRAFT_FACTORY as `0x${string}`,
    abi: CHAINCRAFT_FACTORY_ABI,
    functionName: 'getTokensByCreator',
    args: [address!],
    query: {
      enabled: isConnected && !!address && !!contractAddresses?.CHAINCRAFT_FACTORY,
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

  // TokenDataFetcher component for each token
  const TokenDataFetcher = ({ tokenAddress, onDataFetched }: { tokenAddress: string, onDataFetched: (data: TokenInfo) => void }) => {
    // Fetch name, symbol, totalSupply from token contract
    const { data: name } = useReadContract({
      address: tokenAddress as Address,
      abi: CHAINCRAFT_TOKEN_ABI,
      functionName: "name",
    });
    const { data: symbol } = useReadContract({
      address: tokenAddress as Address,
      abi: CHAINCRAFT_TOKEN_ABI,
      functionName: "symbol",
    });
    const { data: totalSupply } = useReadContract({
      address: tokenAddress as Address,
      abi: CHAINCRAFT_TOKEN_ABI,
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

  // Separate useEffect to handle loading state management
  useEffect(() => {
    if (tokenAddresses && userTokens.length === tokenAddresses.length && userTokens.length > 0) {
      setIsLoadingTokens(false);
    }
  }, [tokenAddresses, userTokens.length]);

  // Auto-select token if provided via props
  useEffect(() => {
    if (selectedTokenAddress && selectedTokenAddress !== selectedToken) {
      setSelectedToken(selectedTokenAddress);
      // Find token symbol from userTokens
      const token = userTokens.find(t => t.address === selectedTokenAddress);
      if (token) {
        setSelectedTokenSymbol(token.symbol);
      }
    }
  }, [selectedTokenAddress, selectedToken, userTokens]);

  // Filter tokens based on search
  const filteredTokens = userTokens.filter(token =>
    token.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTokenSelection = (tokenAddress: string) => {
    const token = userTokens.find(t => t.address === tokenAddress);
    setSelectedToken(tokenAddress as Address);
    if (token) {
      setSelectedTokenSymbol(token.symbol);
    }
  };

  const handlePoolCreated = (poolInfo: any) => {
    console.log('Pool created:', poolInfo);
    if (onPoolCreated) {
      onPoolCreated(poolInfo);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden TokenDataFetcher components for each token */}
      {tokenAddresses && tokenAddresses.map((tokenAddress) => (
        <TokenDataFetcher
          key={tokenAddress}
          tokenAddress={tokenAddress as string}
          onDataFetched={handleTokenDataFetched}
        />
      ))}

      {/* Token Selection Section - only show if showTokenSelection is true */}
      {showTokenSelection && (
        <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">🏗️</span>
            Select Token for Pool Creation
          </h3>

          {/* Connection Status Info */}
          {!isConnected && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-300 text-sm flex items-center">
                <span className="mr-2">⚠️</span>
                Connect your wallet to create pools for your tokens.
              </p>
            </div>
          )}

          {/* Search Bar */}
          {isConnected && (
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search your tokens..."
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
          )}

          {isLoadingTokens ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              <span className="ml-3 text-gray-300">Loading your tokens...</span>
            </div>
          ) : filteredTokens.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {filteredTokens.map((token) => (
                <div
                  key={token.address} 
                  onClick={() => handleTokenSelection(token.address)}
                  className={`bg-gray-700/50 rounded-lg p-4 border cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedToken === token.address 
                      ? 'border-cyan-500 bg-cyan-500/10' 
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{token.symbol}</h4>
                    <div className="flex items-center space-x-2">
                      {selectedToken === token.address && (
                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                      )}
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Your Token</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{token.name}</p>
                  <p className="text-xs text-gray-400">
                    Supply: {Number(token.totalSupply).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : isConnected ? (
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
          ) : null}

          {/* Selected Token Info */}
          {selectedToken && (
            <div className="mt-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
              <p className="text-green-300 text-sm">
                <strong>Selected:</strong> {selectedTokenSymbol} ({selectedToken.slice(0, 8)}...{selectedToken.slice(-6)})
              </p>
              <p className="text-green-200 text-xs mt-1">
                Ready to create or manage SushiSwap V2 pool
              </p>
            </div>
          )}
        </div>
      )}

      {/* Improved Pool Manager */}
      {selectedToken && (
        <ImprovedPoolManager
          tokenAddress={selectedToken}
          tokenSymbol={selectedTokenSymbol}
          onPoolCreated={handlePoolCreated}
        />
      )}

      {/* No Token Selected Message */}
      {!selectedToken && (
        <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-gray-700 text-center">
          <div className="text-6xl mb-4">🏗️</div>
          <h3 className="text-xl font-bold text-white mb-2">No Token Selected</h3>
          <p className="text-gray-400">
            {showTokenSelection 
              ? "Please select a token above to create a liquidity pool"
              : "Please provide a token address to create a liquidity pool"
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default EnhancedPoolCreator;
