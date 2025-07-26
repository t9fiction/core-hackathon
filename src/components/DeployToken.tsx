import { JSX, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseEther } from 'viem';
import { PUMPFUN_FACTORY_ABI } from '../lib/contracts/abis';
import { getContractAddresses, SUPPLY_TIERS } from '../lib/contracts/addresses';

interface DeployTokenProps {
  totalSupply: string;
  renderTierInfo?: (totalSupply: string) => JSX.Element | null;
}

const DeployToken = ({ totalSupply, renderTierInfo }: DeployTokenProps) => {
  const { address, isConnected } = useAccount();
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [localTotalSupply, setLocalTotalSupply] = useState('');
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

    if (supplyNum <= 0) {
      alert('Total supply must be greater than 0');
      return;
    }

    if (liquidityLockDays < 30) {
      alert('Liquidity lock period must be at least 30 days');
      return;
    }

    console.log("Deploying token with:", {
      name,
      symbol,
      totalSupply: supplyNum,
      liquidityLockDays,
      fee: fee.toString(),
      contractAddress
    });

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
      alert('Failed to deploy token. Please check console for details.');
    }
  };

  const isFormValid = name && symbol && totalSupply && Number(totalSupply) > 0;

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <span className="text-blue-400 mr-2">🚀</span>
        Deploy Your Token
      </h2>
      
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
            onChange={(e) => setLocalTotalSupply(e.target.value)}
            placeholder="e.g., 50000000"
            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <p className="text-sm text-gray-400 mt-1">
            Max: {selectedTier.maxSupply.toLocaleString()} tokens for {tier} tier
          </p>
          {renderTierInfo && renderTierInfo(totalSupply)}
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
  );
};

export default DeployToken;