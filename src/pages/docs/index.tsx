import React from 'react';

const Docs = () => {
  return (
    <div className='px-8 py-6 space-y-10 max-w-6xl mx-auto'>
      {/* Header */}
      <section className='text-center'>
        <h1 className='text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent'>ChainCraft Documentation</h1>
        <p className='text-lg text-gray-300 max-w-3xl mx-auto'>Your complete DeFi platform for token creation, trading, and governance on Core DAO. Build, trade, and govern tokens with anti-rug protection, liquidity management, and trust-building features.</p>
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
            <h3 className='font-semibold text-green-400 mb-2'>3. Lock & Trade</h3>
            <p className='text-sm text-gray-400'>Lock tokens for trust, create SushiSwap pools, and participate in governance.</p>
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
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>SushiSwap V2 integration on Core DAO</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Create CORE/Token liquidity pools</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Automated token approvals</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Multi-step pool creation wizard</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>0.3% fixed fee tier (SushiSwap)</li>
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
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>3 proposal types (Transfer/Holding limits, Toggle limits)</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>1000+ token voting requirement</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Time-based voting periods</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Automatic proposal execution</li>
              <li className='flex items-center'><span className='text-green-400 mr-2'>✓</span>Real-time governance statistics</li>
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
        <h2 className='text-2xl font-semibold mb-4 text-yellow-400'>💰 Fee Structure (Core DAO)</h2>
        <div className='grid md:grid-cols-3 gap-4'>
          <div className='bg-gray-900/50 p-4 rounded-lg text-center'>
            <h3 className='font-semibold text-blue-400 mb-2'>Standard</h3>
            <p className='text-2xl font-bold text-white mb-2'>0.05 CORE</p>
            <p className='text-sm text-gray-400'>Up to 100M tokens</p>
          </div>
          <div className='bg-gray-900/50 p-4 rounded-lg text-center border border-purple-500/50'>
            <h3 className='font-semibold text-purple-400 mb-2'>Premium</h3>
            <p className='text-2xl font-bold text-white mb-2'>0.25 CORE</p>
            <p className='text-sm text-gray-400'>Up to 500M tokens</p>
          </div>
          <div className='bg-gray-900/50 p-4 rounded-lg text-center border border-yellow-500/50'>
            <h3 className='font-semibold text-yellow-400 mb-2'>Ultimate</h3>
            <p className='text-2xl font-bold text-white mb-2'>0.5 CORE</p>
            <p className='text-sm text-gray-400'>Up to 1B tokens</p>
          </div>
        </div>
        <div className='mt-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg'>
          <p className='text-blue-300 text-sm'>
            💡 <strong>Note:</strong> All fees are paid in CORE tokens on the Core DAO network. Gas fees are significantly lower than Ethereum mainnet.
          </p>
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
            <p className='text-gray-300'>Create SushiSwap V2 liquidity pools on Core DAO. The system handles token approvals automatically and guides you through pool creation with CORE pairing.</p>
          </div>
          <div className='bg-gray-800/30 p-5 rounded-lg border-l-4 border-green-500'>
            <h3 className='font-semibold text-green-400 mb-2'>Trust Building & Locking</h3>
            <p className='text-gray-300'>Lock tokens with CORE collateral to build community trust. Set custom lock periods (1-365 days) and provide descriptions to show commitment to your project.</p>
          </div>
          <div className='bg-gray-800/30 p-5 rounded-lg border-l-4 border-orange-500'>
            <h3 className='font-semibold text-orange-400 mb-2'>Governance & Community</h3>
            <p className='text-gray-300'>Participate in governance proposals, vote with token power, and manage token parameters through community consensus.</p>
          </div>
        </div>
      </section>

      {/* Detailed Feature Breakdown */}
      <section>
        <h2 className='text-3xl font-semibold mb-6 text-center'>📋 Detailed Features</h2>
        <div className='space-y-6'>
          
          {/* Token Management */}
          <div className='bg-gray-800/50 rounded-xl p-6 border border-gray-700'>
            <h3 className='text-2xl font-semibold mb-4 text-cyan-400'>🪙 Token Management</h3>
            <div className='grid md:grid-cols-2 gap-6'>
              <div>
                <h4 className='font-semibold text-cyan-300 mb-3'>Creation Features:</h4>
                <ul className='space-y-2 text-gray-300 text-sm'>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Custom name, symbol, and total supply</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Three supply tiers: 100M, 500M, 1B tokens</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Automatic minting to creator wallet</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Built-in ERC-20 compliance</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Anti-rug limits: 5% transfer/5% holding max</li>
                </ul>
              </div>
              <div>
                <h4 className='font-semibold text-cyan-300 mb-3'>Token Locking:</h4>
                <ul className='space-y-2 text-gray-300 text-sm'>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Lock any amount of tokens (1-365 days)</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>CORE collateral required for trust</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Custom lock descriptions & messaging</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Public lock information display</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Automatic unlock after period expires</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Governance System */}
          <div className='bg-gray-800/50 rounded-xl p-6 border border-gray-700'>
            <h3 className='text-2xl font-semibold mb-4 text-purple-400'>🗳️ Governance System</h3>
            <div className='grid md:grid-cols-2 gap-6'>
              <div>
                <h4 className='font-semibold text-purple-300 mb-3'>Proposal Types:</h4>
                <ul className='space-y-2 text-gray-300 text-sm'>
                  <li className='flex items-center'><span className='text-purple-400 mr-2'>1.</span><strong>Update Max Transfer:</strong> Change transfer limits</li>
                  <li className='flex items-center'><span className='text-purple-400 mr-2'>2.</span><strong>Update Max Holding:</strong> Modify holding limits</li>
                  <li className='flex items-center'><span className='text-purple-400 mr-2'>3.</span><strong>Toggle Limits:</strong> Enable/disable restrictions</li>
                </ul>
              </div>
              <div>
                <h4 className='font-semibold text-purple-300 mb-3'>Voting System:</h4>
                <ul className='space-y-2 text-gray-300 text-sm'>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>1000+ token minimum to create proposals</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Token-based voting power system</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Time-limited voting periods</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Real-time vote tracking & statistics</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Automatic execution when proposals pass</li>
                </ul>
              </div>
            </div>
          </div>

          {/* DEX Integration */}
          <div className='bg-gray-800/50 rounded-xl p-6 border border-gray-700'>
            <h3 className='text-2xl font-semibold mb-4 text-green-400'>🔄 DEX Integration</h3>
            <div className='grid md:grid-cols-2 gap-6'>
              <div>
                <h4 className='font-semibold text-green-300 mb-3'>Pool Creation:</h4>
                <ul className='space-y-2 text-gray-300 text-sm'>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>SushiSwap V2 factory integration</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>TOKEN/CORE pair creation</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Automated approval workflow</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Step-by-step guided process</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Pool existence verification</li>
                </ul>
              </div>
              <div>
                <h4 className='font-semibold text-green-300 mb-3'>Liquidity Management:</h4>
                <ul className='space-y-2 text-gray-300 text-sm'>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Initial liquidity provision</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Add to existing pools</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>Real-time price calculation</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>5% slippage protection</li>
                  <li className='flex items-center'><span className='text-green-400 mr-2'>▶</span>LP token receipt & tracking</li>
                </ul>
              </div>
            </div>
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
