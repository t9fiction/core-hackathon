import React, { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useBalance } from 'wagmi';
import { Address, formatEther, parseEther, parseUnits } from 'viem';
import { getContractAddresses } from '../../lib/contracts/addresses';
import { CHAINCRAFT_TOKEN_ABI } from '../../lib/contracts/abis';

// SushiSwap V2 Router ABI (for debugging)
const SUSHISWAP_V2_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// SushiSwap V2 Factory ABI (for debugging)
const SUSHISWAP_V2_FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
    ],
    name: "getPair",
    outputs: [{ internalType: "address", name: "pair", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// SushiSwap V2 addresses on Core DAO
const SUSHISWAP_V2_ADDRESSES = {
  1116: { // Core DAO Mainnet
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763",
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",
  }
};

interface SushiSwapDebuggerProps {
  tokenAddress: Address;
  tokenSymbol?: string;
}

export const SushiSwapDebugger: React.FC<SushiSwapDebuggerProps> = ({
  tokenAddress,
  tokenSymbol = "TOKEN"
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  const [debugAmount, setDebugAmount] = useState("0.01");
  const [debugResults, setDebugResults] = useState<any>({});
  
  const contractAddresses = getContractAddresses(chainId);
  const sushiV2Addresses = SUSHISWAP_V2_ADDRESSES[chainId as keyof typeof SUSHISWAP_V2_ADDRESSES];

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Check if pair exists
  const { data: pairAddress, error: pairError, isError: isPairError } = useReadContract({
    address: sushiV2Addresses?.factory as Address,
    abi: SUSHISWAP_V2_FACTORY_ABI,
    functionName: "getPair",
    args: [tokenAddress, contractAddresses.WETH],
    query: {
      enabled: !!(tokenAddress && contractAddresses.WETH && sushiV2Addresses?.factory),
    },
  });

  const pairExists = pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000";

  // Test buy quote
  const { data: buyQuote, error: buyQuoteError, isError: isBuyQuoteError } = useReadContract({
    address: sushiV2Addresses?.router as Address,
    abi: SUSHISWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [
      parseEther(debugAmount),
      [contractAddresses.WETH, tokenAddress]
    ],
    query: {
      enabled: !!(pairExists && sushiV2Addresses?.router && contractAddresses.WETH && tokenAddress),
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

  // Test sell quote
  const { data: sellQuote, error: sellQuoteError, isError: isSellQuoteError } = useReadContract({
    address: sushiV2Addresses?.router as Address,
    abi: SUSHISWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [
      parseUnits("100", 18), // 100 tokens
      [tokenAddress, contractAddresses.WETH]
    ],
    query: {
      enabled: !!(pairExists && sushiV2Addresses?.router && contractAddresses.WETH && tokenAddress),
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

  // Check token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      enabled: !!address,
    },
  });

  // Check token allowance for SushiSwap router
  const { data: tokenAllowance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'allowance',
    args: address && sushiV2Addresses?.router ? [address, sushiV2Addresses.router as Address] : undefined,
    query: {
      enabled: !!(address && sushiV2Addresses?.router),
    },
  });

  useEffect(() => {
    setDebugResults({
      chainId,
      tokenAddress,
      wethAddress: contractAddresses.WETH,
      sushiFactory: sushiV2Addresses?.factory,
      sushiRouter: sushiV2Addresses?.router,
      pairAddress,
      pairExists,
      pairError: pairError?.message,
      buyQuote: buyQuote ? Array.from(buyQuote) : null,
      buyQuoteError: buyQuoteError?.message,
      sellQuote: sellQuote ? Array.from(sellQuote) : null,
      sellQuoteError: sellQuoteError?.message,
      userBalance: ethBalance ? formatEther(ethBalance.value) : '0',
    });
  }, [
    chainId, tokenAddress, contractAddresses.WETH, sushiV2Addresses,
    pairAddress, pairExists, pairError, buyQuote, buyQuoteError,
    sellQuote, sellQuoteError, ethBalance
  ]);

  if (!isConnected) {
    return (
      <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4">
        <p className="text-amber-300">🔌 Connect your wallet to run SushiSwap diagnostics</p>
      </div>
    );
  }

  if (!sushiV2Addresses) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-300">❌ SushiSwap V2 not supported on chain ID: {chainId}</p>
      </div>
    );
  }

  return (
    <div className="bg-purple-900/20 border border-purple-500/50 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center">
        🔍 SushiSwap Trading Diagnostics for {tokenSymbol}
      </h3>
      
      {/* Input for debug amount */}
      <div className="mb-4">
        <label className="block text-purple-300 text-sm mb-2">
          Test ETH Amount (for buy quote):
        </label>
        <input
          type="number"
          step="0.001"
          value={debugAmount}
          onChange={(e) => setDebugAmount(e.target.value)}
          className="w-full p-2 bg-purple-800/30 border border-purple-600/50 rounded text-white"
          placeholder="0.01"
        />
      </div>

      {/* Network Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-purple-800/30 p-4 rounded">
          <h4 className="text-purple-300 font-medium mb-3">🌐 Network Configuration</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-purple-400">Chain ID:</span>
              <span className="text-purple-200 font-mono">{chainId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-400">Your Address:</span>
              <span className="text-purple-200 font-mono text-xs">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-400">ETH Balance:</span>
              <span className="text-purple-200">{parseFloat(debugResults.userBalance || '0').toFixed(4)} CORE</span>
            </div>
          </div>
        </div>

        <div className="bg-purple-800/30 p-4 rounded">
          <h4 className="text-purple-300 font-medium mb-3">🏭 Contract Addresses</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-purple-400">Token:</span>
              <span className="text-purple-200 font-mono">
                {tokenAddress.slice(0, 8)}...{tokenAddress.slice(-6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-400">WCORE:</span>
              <span className="text-purple-200 font-mono">
                {contractAddresses.WETH.slice(0, 8)}...{contractAddresses.WETH.slice(-6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-400">SushiSwap Factory:</span>
              <span className="text-purple-200 font-mono">
                {sushiV2Addresses.factory.slice(0, 8)}...{sushiV2Addresses.factory.slice(-6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-400">SushiSwap Router:</span>
              <span className="text-purple-200 font-mono">
                {sushiV2Addresses.router.slice(0, 8)}...{sushiV2Addresses.router.slice(-6)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pair Status */}
      <div className="bg-purple-800/30 p-4 rounded mb-4">
        <h4 className="text-purple-300 font-medium mb-3">💧 Liquidity Pool Status</h4>
        {isPairError ? (
          <div className="text-red-300 text-sm">
            ❌ Error checking pair: {pairError?.message}
          </div>
        ) : pairExists ? (
          <div className="text-green-300 text-sm">
            ✅ Pool exists at: <span className="font-mono text-xs">{pairAddress}</span>
            <div className="mt-2">
              <a 
                href={`https://scan.coredao.org/address/${pairAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline text-xs"
              >
                View on Core Scan →
              </a>
            </div>
          </div>
        ) : (
          <div className="text-yellow-300 text-sm">
            ⚠️ No liquidity pool found for {tokenSymbol}/CORE pair
          </div>
        )}
      </div>

      {/* Token Balance & Approval Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-800/30 p-4 rounded">
          <h4 className="text-blue-300 font-medium mb-3">💰 Token Balance</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-400">Your Balance:</span>
              <span className="text-blue-200">
                {tokenBalance ? parseFloat(formatEther(tokenBalance as bigint)).toFixed(4) : '0.0000'} {tokenSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">Sell-able:</span>
              <span className="text-blue-200">
                {tokenBalance && parseFloat(formatEther(tokenBalance as bigint)) > 0 ? '✅ Yes' : '❌ No tokens'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-orange-800/30 p-4 rounded">
          <h4 className="text-orange-300 font-medium mb-3">🔐 Token Approval</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-orange-400">Router Allowance:</span>
              <span className="text-orange-200 font-mono text-xs">
                {tokenAllowance ? formatEther(tokenAllowance as bigint).slice(0, 10) + '...' : '0.0000'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-orange-400">Status:</span>
              <span className={`text-sm ${
                tokenAllowance && (tokenAllowance as bigint) > 0n ? 'text-green-300' : 'text-red-300'
              }`}>
                {tokenAllowance && (tokenAllowance as bigint) > 0n ? '✅ Approved' : '❌ Not Approved'}
              </span>
            </div>
            {tokenAllowance && (tokenAllowance as bigint) > 0n && (
              <div className="text-xs text-green-400 mt-1">
                Ready to sell tokens without additional approval
              </div>
            )}
            {(!tokenAllowance || (tokenAllowance as bigint) === 0n) && (
              <div className="text-xs text-yellow-400 mt-1">
                Approval will be requested when you sell tokens
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trading Quotes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-900/20 border border-green-500/30 p-4 rounded">
          <h4 className="text-green-300 font-medium mb-3">💰 Buy Quote Test</h4>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-green-400">Input:</span>
              <span className="text-green-200">{debugAmount} CORE</span>
            </div>
            {isBuyQuoteError ? (
              <div className="text-red-300">
                ❌ Error: {buyQuoteError?.message}
              </div>
            ) : buyQuote && Array.isArray(buyQuote) && buyQuote.length > 1 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-green-400">Output:</span>
                  <span className="text-green-200">
                    {parseFloat(formatEther(buyQuote[1] as bigint)).toFixed(6)} {tokenSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">Rate:</span>
                  <span className="text-green-200">
                    1 CORE = {(parseFloat(formatEther(buyQuote[1] as bigint)) / parseFloat(debugAmount)).toFixed(2)} {tokenSymbol}
                  </span>
                </div>
              </>
            ) : pairExists ? (
              <div className="text-yellow-300">⏳ Loading quote...</div>
            ) : (
              <div className="text-gray-400">💭 No pool available</div>
            )}
          </div>
        </div>

        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded">
          <h4 className="text-red-300 font-medium mb-3">💸 Sell Quote Test</h4>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-red-400">Input:</span>
              <span className="text-red-200">100 {tokenSymbol}</span>
            </div>
            {isSellQuoteError ? (
              <div className="text-red-300">
                ❌ Error: {sellQuoteError?.message}
              </div>
            ) : sellQuote && Array.isArray(sellQuote) && sellQuote.length > 1 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-red-400">Output:</span>
                  <span className="text-red-200">
                    {parseFloat(formatEther(sellQuote[1] as bigint)).toFixed(6)} CORE
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">Rate:</span>
                  <span className="text-red-200">
                    1 {tokenSymbol} = {(parseFloat(formatEther(sellQuote[1] as bigint)) / 100).toFixed(8)} CORE
                  </span>
                </div>
              </>
            ) : pairExists ? (
              <div className="text-yellow-300">⏳ Loading quote...</div>
            ) : (
              <div className="text-gray-400">💭 No pool available</div>
            )}
          </div>
        </div>
      </div>

      {/* Raw Debug Data */}
      <details className="mt-6">
        <summary className="text-purple-300 cursor-pointer hover:text-purple-200">
          🔧 Raw Debug Data (Click to expand)
        </summary>
        <pre className="mt-3 p-4 bg-black/30 rounded text-xs text-purple-200 overflow-auto max-h-64">
          {JSON.stringify(debugResults, null, 2)}
        </pre>
      </details>

      {/* Recommendations */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded">
        <h4 className="text-blue-300 font-medium mb-2">💡 Troubleshooting Tips</h4>
        <ul className="text-blue-200 text-sm space-y-1 list-disc list-inside">
          {!pairExists && (
            <li>Create a liquidity pool first using the Pool Manager</li>
          )}
          {pairExists && (isBuyQuoteError || isSellQuoteError) && (
            <li>Check if the SushiSwap Router contract is working correctly</li>
          )}
          <li>Verify that the WCORE address matches SushiSwap's expected address</li>
          <li>Ensure sufficient liquidity exists in the pool</li>
          <li>Check network connection and RPC endpoint</li>
        </ul>
      </div>
    </div>
  );
};

export default SushiSwapDebugger;
