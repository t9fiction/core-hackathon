import React from 'react';

const Docs = () => {
  return (
    <div className='px-8 py-6 space-y-10 max-w-6xl mx-auto'>
      {/* Header */}
      <section className='text-center'>
        <h1 className='text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent'>ChainCraft Documentation</h1>
        <p className='text-lg text-gray-300 max-w-3xl mx-auto'>Your complete DeFi platform for token creation, trading, and governance. Build, trade, and govern tokens with anti-rug protection and advanced features.</p>
      </section>

      {/* Quick Start */}
      <section className='bg-gray-800/50 rounded-xl p-6 border border-gray-700'>
        <h2 className='text-2xl font-semibold mb-4 text-blue-400'>🚀 Quick Start</h2>
        <div className='grid md:grid-cols-3 gap-4'>
          <div className='bg-gray-900/50 p-4 rounded-lg'>
            <h3 className='font-semibold text-green-400 mb-2'>1. Connect Wallet</h3>
            <p className='text-sm text-gray-400'>Connect your Web3 wallet to start using ChainCraft features.</p>
          </div>
          <div className='bg-gray-900/50 p-4 rounded-lg'>
            <h3 className='font-semibold text-green-400 mb-2'>2. Create Token</h3>
            <p className='text-sm text-gray-400'>Deploy your own ERC-20 token with built-in protection.</p>
          </div>
          <div className='bg-gray-900/50 p-4 rounded-lg'>
            <h3 className='font-semibold text-green-400 mb-2'>3. Trade & Govern</h3>
            <p className='text-sm text-gray-400'>Create liquidity pools, trade tokens, and participate in governance.</p>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section>
        <h2 className='text-3xl font-semibold mb-6 text-center'>🔥 Core Features</h2>
        <div className='grid md:grid-cols-2 gap-6'>
          
          {/* Token Creation */}
          <div className='bg-gradient-to-br from-blue-900/30 to-blue-800/20 p-6 rounded-xl border border-blue-700/30'>
            <h3 className='text-xl font-semibold mb-3 text-blue-400'>💎 Token Creation</h3>
            <ul className='space-y-2 text-gray-300'>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Deploy ERC-20 tokens instantly</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Anti-rug protection built-in</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Tiered pricing (100M/500M/1B supply)</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>5% transfer & holding limits</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Automatic ownership management</li>
            </ul>
          </div>

          {/* DEX & Trading */}
          <div className='bg-gradient-to-br from-purple-900/30 to-purple-800/20 p-6 rounded-xl border border-purple-700/30'>
            <h3 className='text-xl font-semibold mb-3 text-purple-400'>🔄 DEX & Trading</h3>
            <ul className='space-y-2 text-gray-300'>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Uniswap V3 integration</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Create liquidity pools</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Token swapping (ETH ↔ Tokens)</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Automatic slippage protection</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Real-time price tracking</li>
            </ul>
          </div>

          {/* Token Locking */}
          <div className='bg-gradient-to-br from-green-900/30 to-green-800/20 p-6 rounded-xl border border-green-700/30'>
            <h3 className='text-xl font-semibold mb-3 text-green-400'>🔒 Token Locking</h3>
            <ul className='space-y-2 text-gray-300'>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Lock tokens with ETH collateral</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Flexible lock duration (1-365 days)</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Build community trust</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Custom lock descriptions</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Automated unlock system</li>
            </ul>
          </div>

          {/* Governance */}
          <div className='bg-gradient-to-br from-orange-900/30 to-orange-800/20 p-6 rounded-xl border border-orange-700/30'>
            <h3 className='text-xl font-semibold mb-3 text-orange-400'>🗳️ Governance</h3>
            <ul className='space-y-2 text-gray-300'>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Create & vote on proposals</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Token-based voting power</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Proposal execution</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Community airdrops</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Governance statistics</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Anti-Rug Protection */}
      <section className='bg-gradient-to-r from-red-900/20 to-pink-900/20 p-6 rounded-xl border border-red-700/30'>
        <h2 className='text-2xl font-semibold mb-4 text-red-400'>🛡️ Anti-Rug Protection</h2>
        <div className='grid md:grid-cols-2 gap-6'>
          <div>
            <h3 className='font-semibold mb-3 text-pink-400'>Built-in Security Features:</h3>
            <ul className='space-y-2 text-gray-300'>
              <li className='flex items-center'><span className='text-green-400 mr-2'>•</span>5% maximum transfer limit per transaction</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>•</span>5% maximum wallet holding limit</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>•</span>Factory-verified token deployments</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>•</span>Transparent fee structure</li>
            </ul>
          </div>
          <div>
            <h3 className='font-semibold mb-3 text-pink-400'>Community Trust:</h3>
            <ul className='space-y-2 text-gray-300'>
              <li className='flex items-center'><span className='text-green-400 mr-2'>•</span>Token locking with ETH collateral</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>•</span>Public deployment history</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>•</span>Creator accountability</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>•</span>Governance oversight</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Fee Structure */}
      <section className='bg-gray-800/50 rounded-xl p-6 border border-gray-700'>
        <h2 className='text-2xl font-semibold mb-4 text-yellow-400'>💰 Fee Structure</h2>
        <div className='grid md:grid-cols-3 gap-4'>
          <div className='bg-gray-900/50 p-4 rounded-lg text-center'>
            <h3 className='font-semibold text-blue-400 mb-2'>Standard</h3>
            <p className='text-2xl font-bold text-white mb-2'>0.05 ETH</p>
            <p className='text-sm text-gray-400'>Up to 100M tokens</p>
          </div>
          <div className='bg-gray-900/50 p-4 rounded-lg text-center border border-purple-500/50'>
            <h3 className='font-semibold text-purple-400 mb-2'>Premium</h3>
            <p className='text-2xl font-bold text-white mb-2'>0.25 ETH</p>
            <p className='text-sm text-gray-400'>Up to 500M tokens</p>
          </div>
          <div className='bg-gray-900/50 p-4 rounded-lg text-center border border-yellow-500/50'>
            <h3 className='font-semibold text-yellow-400 mb-2'>Ultimate</h3>
            <p className='text-2xl font-bold text-white mb-2'>0.5 ETH</p>
            <p className='text-sm text-gray-400'>Up to 1B tokens</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section>
        <h2 className='text-2xl font-semibold mb-6 text-center'>⚙️ How It Works</h2>
        <div className='space-y-6'>
          <div className='bg-gray-800/30 p-5 rounded-lg border-l-4 border-blue-500'>
            <h3 className='font-semibold text-blue-400 mb-2'>Token Deployment</h3>
            <p className='text-gray-300'>Create ERC-20 tokens with custom name, symbol, and supply. All tokens are minted to the creator with built-in anti-rug protection limits.</p>
          </div>
          <div className='bg-gray-800/30 p-5 rounded-lg border-l-4 border-purple-500'>
            <h3 className='font-semibold text-purple-400 mb-2'>Liquidity Creation</h3>
            <p className='text-gray-300'>Create Uniswap V3 liquidity pools for your tokens. Provide initial liquidity with ETH to enable trading.</p>
          </div>
          <div className='bg-gray-800/30 p-5 rounded-lg border-l-4 border-green-500'>
            <h3 className='font-semibold text-green-400 mb-2'>Trading & Swaps</h3>
            <p className='text-gray-300'>Trade tokens directly through the integrated DEX with automatic slippage protection and real-time pricing.</p>
          </div>
          <div className='bg-gray-800/30 p-5 rounded-lg border-l-4 border-orange-500'>
            <h3 className='font-semibold text-orange-400 mb-2'>Governance & Community</h3>
            <p className='text-gray-300'>Participate in governance proposals, vote with token power, and distribute airdrops to build strong communities.</p>
          </div>
        </div>
      </section>

      {/* Navigation Links */}
      <section className='bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6 rounded-xl border border-blue-700/30'>
        <h2 className='text-2xl font-semibold mb-4 text-center'>🧭 Navigation</h2>
        <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <a href='/deploy' className='bg-blue-900/50 p-4 rounded-lg hover:bg-blue-900/70 transition-colors text-center'>
            <h3 className='font-semibold text-blue-400 mb-2'>Deploy Tokens</h3>
            <p className='text-sm text-gray-400'>Create new ERC-20 tokens</p>
          </a>
          <a href='/dex' className='bg-purple-900/50 p-4 rounded-lg hover:bg-purple-900/70 transition-colors text-center'>
            <h3 className='font-semibold text-purple-400 mb-2'>DEX Trading</h3>
            <p className='text-sm text-gray-400'>Trade and provide liquidity</p>
          </a>
          <a href='/governance' className='bg-green-900/50 p-4 rounded-lg hover:bg-green-900/70 transition-colors text-center'>
            <h3 className='font-semibold text-green-400 mb-2'>Governance</h3>
            <p className='text-sm text-gray-400'>Vote on proposals</p>
          </a>
          <a href='/tokens' className='bg-orange-900/50 p-4 rounded-lg hover:bg-orange-900/70 transition-colors text-center'>
            <h3 className='font-semibold text-orange-400 mb-2'>Token Explorer</h3>
            <p className='text-sm text-gray-400'>Browse all tokens</p>
          </a>
        </div>
      </section>

      {/* Footer */}
      <section className='text-center py-6 border-t border-gray-700'>
        <p className='text-gray-400 mb-2'>Built with security and community in mind</p>
        <p className='text-sm text-gray-500'>ChainCraft - Your trusted DeFi platform</p>
      </section>
    </div>
  );
};

export default Docs;
