import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { formatEther } from 'viem';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from '../lib/contracts/abis';
import { getContractAddresses } from '../lib/contracts/addresses';

interface TokenInfo {
  tokenAddress: string;
  creator: string;
  deploymentTime: bigint;
  liquidityLockPeriodDays: bigint;
  name?: string;
  symbol?: string;
  totalSupply?: bigint;
  balance?: bigint;
}

const TokenManager = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');

  if(chainId !== 11155111) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Unsupported Network</h2>
          <p className="text-gray-400">Please switch to the Sepolia testnet to use this feature.</p>
        </div>
      </div>
    );
  }
  const contractAddress = getContractAddresses(chainId).PUMPFUN_FACTORY;

  // Get all tokens created by the user
  const { data: creatorTokens } = useReadContract({
    address: contractAddress,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: 'creatorTokens',
    args: address ? [address, BigInt(0)] : undefined,
  });

  // Get all deployed tokens
  const { data: allTokens } = useReadContract({
    address: contractAddress,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: 'allDeployedTokens',
  });

  useEffect(() => {
    if (creatorTokens && creatorTokens.length > 0) {
      const fetchTokenDetails = async () => {
        const tokenDetails: TokenInfo[] = [];
        
        for (const tokenAddress of creatorTokens) {
          try {
            // Fetch basic token info from factory
            const tokenInfo = await fetch(`/api/token-info?address=${tokenAddress}`).then(r => r.json());
            tokenDetails.push({
              tokenAddress,
              ...tokenInfo
            });
          } catch (error) {
            console.error('Error fetching token details:', error);
          }
        }
        
        setTokens(tokenDetails);
      };

      fetchTokenDetails();
    }
  }, [creatorTokens]);

  const TokenCard = ({ token }: { token: TokenInfo }) => (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{token.name || 'Unknown Token'}</h3>
          <p className="text-gray-400">{token.symbol || 'N/A'}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Total Supply</p>
          <p className="text-white font-medium">
            {token.totalSupply ? formatEther(token.totalSupply) : 'N/A'}
          </p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Contract:</span>
          <span className="text-white font-mono text-xs">
            {token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Deployed:</span>
          <span className="text-white">
            {new Date(Number(token.deploymentTime) * 1000).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Lock Period:</span>
          <span className="text-white">{token.liquidityLockPeriodDays.toString()} days</span>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setSelectedToken(token.tokenAddress)}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm transition-colors"
        >
          Manage
        </button>
        <button className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg text-sm transition-colors">
          View on Explorer
        </button>
      </div>
    </div>
  );

  const TokenManagement = ({ tokenAddress }: { tokenAddress: string }) => {
    const [lockAmount, setLockAmount] = useState('');
    const [lockDuration, setLockDuration] = useState(30);

    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mt-6">
        <h3 className="text-xl font-bold text-white mb-4">Token Management</h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Lock Tokens</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Amount to Lock</label>
                <input
                  type="number"
                  value={lockAmount}
                  onChange={(e) => setLockAmount(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Duration (days)</label>
                <input
                  type="number"
                  value={lockDuration}
                  onChange={(e) => setLockDuration(Number(e.target.value))}
                  min="1"
                  max="365"
                  className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
                />
              </div>
              <button className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded transition-colors">
                Lock Tokens
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Transfer Settings</h4>
            <div className="space-y-3">
              <button className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded transition-colors">
                Update Max Transfer
              </button>
              <button className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded transition-colors">
                Update Max Holding
              </button>
              <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded transition-colors">
                Toggle Transfer Limits
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setSelectedToken('')}
          className="mt-4 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded transition-colors"
        >
          Back to Token List
        </button>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400">Please connect your wallet to view your tokens</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            My Tokens
          </h1>
          <p className="text-gray-300 text-lg">
            Manage your deployed tokens and view analytics
          </p>
        </div>

        {selectedToken ? (
          <TokenManagement tokenAddress={selectedToken} />
        ) : (
          <>
            {tokens.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🪙</div>
                <h3 className="text-xl font-bold text-white mb-2">No Tokens Found</h3>
                <p className="text-gray-400 mb-6">You haven't deployed any tokens yet</p>
                <button
                  onClick={() => window.location.href = '/deploy'}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-6 rounded-lg transition-colors"
                >
                  Deploy Your First Token
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tokens.map((token) => (
                  <TokenCard key={token.tokenAddress} token={token} />
                ))}
              </div>
            )}

            {allTokens && allTokens.length > 0 && (
              <div className="mt-12">
                <h2 className="text-2xl font-bold text-white mb-6">All Deployed Tokens</h2>
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <p className="text-gray-300">
                    Total tokens deployed on the platform: <span className="text-blue-400 font-bold">{allTokens.length}</span>
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TokenManager;
