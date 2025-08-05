import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseEther } from 'viem';
import { PUMPFUN_FACTORY_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';

interface TokenDeploymentFormProps {
  onDeploymentSuccess?: (hash: string) => void;
}

const TokenDeploymentForm: React.FC<TokenDeploymentFormProps> = ({ onDeploymentSuccess }) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    totalSupply: '',
    lockPeriod: '30'
  });

  const contractAddress = getContractAddresses(chainId).PUMPFUN_FACTORY;
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Supply tier calculation
  const getSupplyTier = (supply: string) => {
    const supplyNum = parseInt(supply) || 0;
    if (supplyNum <= 100000000) return { tier: 'Standard', fee: '0.05', maxSupply: '100M', color: 'bg-green-500' };
    if (supplyNum <= 500000000) return { tier: 'Premium', fee: '0.15', maxSupply: '500M', color: 'bg-yellow-500' };
    return { tier: 'Ultimate', fee: '0.50', maxSupply: '1B', color: 'bg-purple-500' };
  };

  const currentTier = getSupplyTier(formData.totalSupply);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDeploy = async () => {
    // Validation
    if (!formData.name || !formData.symbol || !formData.totalSupply) {
      alert('Please fill in all required fields');
      return;
    }

    const supplyNum = parseInt(formData.totalSupply);
    if (supplyNum <= 0) {
      alert('Total supply must be greater than 0');
      return;
    }

    const lockDays = parseInt(formData.lockPeriod);
    if (lockDays < 30) {
      alert('Lock period must be at least 30 days');
      return;
    }

    try {
      console.log('Deploying token:', {
        ...formData,
        totalSupply: supplyNum,
        lockPeriod: lockDays,
        fee: currentTier.fee,
        contractAddress
      });

      await writeContract({
        address: contractAddress,
        abi: PUMPFUN_FACTORY_ABI,
        functionName: 'deployToken',
        args: [formData.name, formData.symbol, BigInt(supplyNum)],
        value: parseEther(currentTier.fee.toString()),
      });

    } catch (error: any) {
      console.error('Deployment failed:', error);
      const errorMessage = error?.message || error?.reason || 'Deployment failed. Please try again.';
      alert(errorMessage);
    }
  };

  // Call onDeploymentSuccess when deployment is successful
  React.useEffect(() => {
    if (isSuccess && hash && onDeploymentSuccess) {
      onDeploymentSuccess(hash);
      // Reset form
      setFormData({ name: '', symbol: '', totalSupply: '', lockPeriod: '30' });
    }
  }, [isSuccess, hash, onDeploymentSuccess]);

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <span className="text-blue-400 mr-2">🚀</span>
        Deploy Your Token
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Token Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="e.g., TigerShark"
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Token Symbol *</label>
          <input
            type="text"
            value={formData.symbol}
            onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
            placeholder="e.g., TGS"
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Total Supply *</label>
          <input
            type="number"
            value={formData.totalSupply}
            onChange={(e) => handleInputChange('totalSupply', e.target.value)}
            placeholder="e.g., 50000000"
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {formData.totalSupply && (
            <div className="mt-2 p-3 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm">Selected Tier:</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${currentTier.color} text-black`}>
                  {currentTier.tier}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm">Deployment Fee:</span>
                <span className="font-bold">{currentTier.fee} ETH</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Liquidity Lock Period (Days)</label>
          <select
            value={formData.lockPeriod}
            onChange={(e) => handleInputChange('lockPeriod', e.target.value)}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="30">30 days (Minimum)</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">365 days</option>
          </select>
        </div>

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{error.message}</p>
          </div>
        )}

        <button
          onClick={handleDeploy}
          disabled={!isConnected || isPending || isConfirming || !formData.name || !formData.symbol || !formData.totalSupply}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        >
          {isPending || isConfirming ? (
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
              {isPending ? 'Confirming...' : 'Deploying...'}
            </span>
          ) : (
            `Deploy Token (${currentTier.fee} ETH)`
          )}
        </button>

        {isSuccess && (
          <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg">
            <p className="text-green-300 text-sm">✅ Token deployed successfully!</p>
            {hash && (
              <p className="text-xs text-gray-400 mt-1 break-all">
                Transaction: {hash}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenDeploymentForm;
