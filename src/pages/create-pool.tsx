import React, { useState } from 'react';
import { Address } from 'viem';
import SushiSwapV2PoolCreator from '../components/DEX/SushiSwapV2PoolCreator';

export default function CreatePool() {
  const [tokenAddress, setTokenAddress] = useState<Address>("0xe2f50e3fb3946fc890cbf98f5fb404d57c07a949");
  const [tokenSymbol, setTokenSymbol] = useState("TOKEN");

  const handlePoolCreated = (poolInfo: any) => {
    console.log("Pool created:", poolInfo);
    // You can add more logic here, like showing a success notification
    // or redirecting to a pool management page
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Create SushiSwap Pool</h1>
          <p className="text-gray-300 text-lg">
            Create a SushiSwap V2 liquidity pool for your token on Core DAO. This will enable trading for your token.
          </p>
        </div>

        {/* Token Input Section */}
        <div className="mb-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-blue-400">Token Details</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">
                Token Address
              </label>
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value as Address)}
                placeholder="0x..."
                className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter your deployed token address
              </p>
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">
                Token Symbol
              </label>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                placeholder="TOKEN"
                className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Display name for your token
              </p>
            </div>
          </div>
        </div>

        {/* Pool Creator Component */}
        <SushiSwapV2PoolCreator
          tokenAddress={tokenAddress}
          tokenSymbol={tokenSymbol}
          onPoolCreated={handlePoolCreated}
        />

        {/* Information Section */}
        <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4 text-blue-400">ℹ️ How It Works</h3>
          <div className="space-y-4 text-sm text-gray-300">
            <div>
              <h4 className="font-semibold text-white mb-2">1. Authorize Token</h4>
              <p>First, your token needs to be authorized for DEX trading through your ChainCraft Factory contract.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-2">2. Approve Tokens</h4>
              <p>Approve your token for spending by the SushiSwap V2 Router contract.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-2">3. Create Pool (if needed)</h4>
              <p>If a pool doesn't exist yet, we'll create a new SushiSwap V2 pool for your token paired with CORE.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-2">4. Add Initial Liquidity</h4>
              <p>Add the initial liquidity to the pool, which will set the starting price and enable trading.</p>
            </div>
          </div>
        </div>

        {/* Requirements Section */}
        <div className="mt-8 bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4 text-yellow-400">⚠️ Requirements</h3>
          <div className="space-y-2 text-sm text-gray-300">
            <p>• You must be connected to Core DAO Mainnet (Chain ID: 1116)</p>
            <p>• You need to be the creator of the token (deployed through ChainCraft Factory)</p>
            <p>• Have enough tokens and CORE in your wallet for initial liquidity</p>
            <p>• Recommended: At least 0.1 CORE and 1000+ tokens for meaningful liquidity</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h4 className="font-semibold text-blue-400 mb-2">🔍 Check Your Token</h4>
            <p className="text-sm text-gray-300 mb-3">
              Verify your token details and make sure you have enough balance.
            </p>
            <a
              href={`https://scan.coredao.org/address/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              View on Core Scan →
            </a>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h4 className="font-semibold text-green-400 mb-2">🍣 SushiSwap Info</h4>
            <p className="text-sm text-gray-300 mb-3">
              Learn more about SushiSwap V2 pools and liquidity provision.
            </p>
            <a
              href="https://docs.sushi.com/docs/Products/Classic%20AMM/What%20Is%20Classic%20AMM"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 text-sm underline"
            >
              SushiSwap V2 Docs →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
