import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseEther } from 'viem';
import { PUMPFUN_FACTORY_ABI } from '../lib/contracts/abis';
import { getContractAddresses, SUPPLY_TIERS } from '../lib/contracts/addresses';

const DeployToken = () => {
  const { address, isConnected } = useAccount();
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [totalSupply, setTotalSupply] = useState('');
  const [liquidityLockDays, setLiquidityLockDays] = useState(30);
  const [tier, setTier] = useState<'STANDARD' | 'PREMIUM' | 'ULTIMATE'>('STANDARD');
  const chainId = useChainId();

  const contractAddress = getContractAddresses(chainId).PUMPFUN_FACTORY;
  const selectedTier = SUPPLY_TIERS[tier];
  const fee = selectedTier.baseFee;

  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleDeploy = async () => {
    if (!name || !symbol || !totalSupply) {
      alert('Please fill in all fields');
      return;
    }

    const supplyNum = Number(totalSupply);
    if (supplyNum > Number(selectedTier.maxSupply)) {
      alert(`Supply exceeds maximum for ${tier} tier (${selectedTier.maxSupply.toLocaleString()})`);
      return;
    }

    try {
      writeContract({
        address: contractAddress,
        abi: PUMPFUN_FACTORY_ABI,
        functionName: 'deployToken',
        args: [name, symbol, BigInt(supplyNum), BigInt(liquidityLockDays)],
        value: parseEther(fee.toString()),
      });
    } catch (err) {
      console.error('Error deploying token:', err);
    }
  };

  const isFormValid = name && symbol && totalSupply && Number(totalSupply) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Deploy Your Token
          </h1>
          <p className="text-gray-300 text-lg">
            Create a sustainable meme token with built-in anti-rug pull protection
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-white">Token Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 font-medium mb-2">Token Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., TigerShark"
                  className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">Token Symbol *</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., TGS"
                  className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">Total Supply *</label>
                <input
                  type="number"
                  value={totalSupply}
                  onChange={(e) => setTotalSupply(e.target.value)}
                  placeholder="e.g., 50000000"
                  className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Max: {selectedTier.maxSupply.toLocaleString()} tokens for {tier} tier
                </p>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">Supply Tier</label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as 'STANDARD' | 'PREMIUM' | 'ULTIMATE')}
                  className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="STANDARD">Standard - Up to 100M tokens</option>
                  <option value="PREMIUM">Premium - Up to 500M tokens</option>
                  <option value="ULTIMATE">Ultimate - Up to 1B tokens</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">Liquidity Lock Period</label>
                <input
                  type="number"
                  value={liquidityLockDays}
                  onChange={(e) => setLiquidityLockDays(Number(e.target.value))}
                  min="30"
                  className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                />
                <p className="text-sm text-gray-400 mt-1">Minimum 30 days required</p>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-lg">
                <p className="text-red-300 text-sm">{error.message}</p>
              </div>
            )}

            <button
              onClick={handleDeploy}
              disabled={!isConnected || isPending || isConfirming || !isFormValid}
              className="w-full mt-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {isPending ? 'Confirming...' : 'Deploying...'}
                </div>
              ) : (
                `Deploy Token - ${fee} ETH`
              )}
            </button>

            {isSuccess && (
              <div className="mt-4 p-3 bg-green-900/50 border border-green-500 rounded-lg">
                <p className="text-green-300 text-sm">✅ Token deployed successfully!</p>
                {hash && (
                  <p className="text-xs text-gray-400 mt-1 break-all">
                    Transaction: {hash}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-white">Tier Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Selected Tier:</span>
                  <span className="text-white font-medium">{selectedTier.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Deployment Fee:</span>
                  <span className="text-white font-medium">{fee} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Max Supply:</span>
                  <span className="text-white font-medium">{selectedTier.maxSupply.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-white">Token Distribution</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Creator (You):</span>
                  <span className="text-white">10%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Liquidity Pool:</span>
                  <span className="text-white">20%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">DEX Pool:</span>
                  <span className="text-white">40%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Community:</span>
                  <span className="text-white">30%</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-white">Features Included</h3>
              <div className="space-y-2">
                <div className="flex items-center text-green-400">
                  <span className="mr-2">✓</span>
                  <span>Anti-rug pull protection</span>
                </div>
                <div className="flex items-center text-green-400">
                  <span className="mr-2">✓</span>
                  <span>Liquidity locking</span>
                </div>
                <div className="flex items-center text-green-400">
                  <span className="mr-2">✓</span>
                  <span>Transfer restrictions</span>
                </div>
                <div className="flex items-center text-green-400">
                  <span className="mr-2">✓</span>
                  <span>Community governance</span>
                </div>
                <div className="flex items-center text-green-400">
                  <span className="mr-2">✓</span>
                  <span>Token locking mechanism</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeployToken;

