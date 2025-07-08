import React, { useState } from "react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient } from 'wagmi';

const Token = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [totalSupply, setTotalSupply] = useState('');
  const [lockPeriod, setLockPeriod] = useState('30');
  const [isDeploying, setIsDeploying] = useState(false);

  // Token management states
  const [selectedToken, setSelectedToken] = useState("");
  const [lockAmount, setLockAmount] = useState("");
  const [lockDuration, setLockDuration] = useState("");
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [ethAmount, setEthAmount] = useState("");

  // Supply tier calculation
  const getSupplyTier = (supply: string) => {
    const supplyNum = parseInt(supply) || 0;
    if (supplyNum <= 100000000) return { tier: 'Standard', fee: '0.05', maxSupply: '100M', color: 'bg-green-500' };
    if (supplyNum <= 500000000) return { tier: 'Premium', fee: '0.15', maxSupply: '500M', color: 'bg-yellow-500' };
    return { tier: 'Ultimate', fee: '0.50', maxSupply: '1B', color: 'bg-purple-500' };
  };
  
  const currentTier = getSupplyTier(totalSupply);

  const handleDeployToken = async () => {
    if (!isConnected || !walletClient) return;
    
    setIsDeploying(true);
    try {
      // This would call your actual contract
      console.log('Deploying token:', {
        name: tokenName,
        symbol: tokenSymbol,
        totalSupply: totalSupply,
        lockPeriod: lockPeriod,
        fee: currentTier.fee
      });
      
      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reset form
      setTokenName('');
      setTokenSymbol('');
      setTotalSupply('');
      setLockPeriod('30');
      
      alert('Token deployed successfully!');
    } catch (error) {
      console.error('Deployment failed:', error);
      alert('Deployment failed. Please try again.');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="py-12 px-14">
      {/* Main Content Tabs */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Token Deployment */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <span className="text-blue-400 mr-2">🚀</span>
              Deploy Your Token
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Token Name
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g., TigerShark"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Token Symbol
                </label>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="e.g., TGS"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Total Supply
                </label>
                <input
                  type="number"
                  value={totalSupply}
                  onChange={(e) => setTotalSupply(e.target.value)}
                  placeholder="e.g., 50000000"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {totalSupply && (
                  <div className="mt-2 p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Selected Tier:</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${currentTier.color} text-black`}
                      >
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
                <label className="block text-sm font-medium mb-2">
                  Liquidity Lock Period (Days)
                </label>
                <select
                  value={lockPeriod}
                  onChange={(e) => setLockPeriod(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="30">30 days (Minimum)</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">365 days</option>
                </select>
              </div>

              <button
                onClick={handleDeployToken}
                disabled={
                  !isConnected ||
                  isDeploying ||
                  !tokenName ||
                  !tokenSymbol ||
                  !totalSupply
                }
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
              >
                {isDeploying ? (
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
                    Deploying...
                  </span>
                ) : (
                  `Deploy Token (${currentTier.fee} ETH)`
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Stats & Info */}
        <div className="space-y-6">
          {/* Connection Status */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Connection Status</h3>
            {isConnected ? (
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-sm">Connected</span>
                </div>
                <p className="text-xs text-gray-400 break-all">{address}</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-3">
                  Connect your wallet to deploy tokens
                </p>
                <ConnectButton />
              </div>
            )}
          </div>

          {/* Platform Stats */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Platform Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Total Tokens</span>
                <span className="font-bold">1,247</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Total Locked</span>
                <span className="font-bold">$2.4M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Active Proposals</span>
                <span className="font-bold">23</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">
                  Rug Pulls Prevented
                </span>
                <span className="font-bold text-green-400">187</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Management Sections */}
      <div className="mt-12 grid md:grid-cols-2 gap-8">
        {/* Token Management */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className="text-yellow-400 mr-2">🔐</span>
            Token Management
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Token Address
              </label>
              <input
                type="text"
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                placeholder="0x..."
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Lock Amount
                </label>
                <input
                  type="number"
                  value={lockAmount}
                  onChange={(e) => setLockAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Lock Days
                </label>
                <input
                  type="number"
                  value={lockDuration}
                  onChange={(e) => setLockDuration(e.target.value)}
                  placeholder="90"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              disabled={!isConnected}
              className="w-full bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              Lock Tokens
            </button>
          </div>
        </div>

        {/* Liquidity Management */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className="text-green-400 mr-2">💧</span>
            Add Liquidity
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Token Amount
              </label>
              <input
                type="number"
                value={liquidityAmount}
                onChange={(e) => setLiquidityAmount(e.target.value)}
                placeholder="10000"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                ETH Amount
              </label>
              <input
                type="number"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                placeholder="1.0"
                step="0.01"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <button
              disabled={!isConnected}
              className="w-full bg-green-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              Add & Lock Liquidity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Token;