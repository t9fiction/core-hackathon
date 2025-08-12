import React, { useState } from 'react';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { Address, parseUnits, formatEther } from 'viem';
import { getContractAddresses } from '../../lib/contracts/addresses';
import { CHAINCRAFT_TOKEN_ABI } from '../../lib/contracts/abis';

// SushiSwap V2 Router ABI (for selling)
const SUSHISWAP_V2_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForETH",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
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

// SushiSwap V2 addresses on Core DAO
const SUSHISWAP_V2_ADDRESSES = {
  1116: { // Core DAO Mainnet
    factory: "0xb45e53277a7e0f1d35f2a77160e91e25507f1763",
    router: "0x9b3336186a38e1b6c21955d112dbb0343ee061ee",
  }
};

interface SellDebuggerProps {
  tokenAddress: Address;
  tokenSymbol?: string;
}

export const SellDebugger: React.FC<SellDebuggerProps> = ({
  tokenAddress,
  tokenSymbol = "TOKEN"
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  const [testAmount, setTestAmount] = useState("10");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [step, setStep] = useState(0); // 0: ready, 1: approving, 2: selling, 3: done
  
  const contractAddresses = getContractAddresses(chainId);
  const sushiV2Addresses = SUSHISWAP_V2_ADDRESSES[chainId as keyof typeof SUSHISWAP_V2_ADDRESSES];

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
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

  // Check token allowance
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'allowance',
    args: address && sushiV2Addresses?.router ? [address, sushiV2Addresses.router as Address] : undefined,
    query: {
      enabled: !!(address && sushiV2Addresses?.router),
    },
  });

  // Get sell quote
  const { data: sellQuote } = useReadContract({
    address: sushiV2Addresses?.router as Address,
    abi: SUSHISWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [
      parseUnits(testAmount, 18),
      [tokenAddress, contractAddresses.WETH]
    ],
    query: {
      enabled: !!(sushiV2Addresses?.router && contractAddresses.WETH && tokenAddress),
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

  const addLog = (message: string) => {
    console.log(`🔧 ${message}`);
    setDebugLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const needsApproval = () => {
    if (!tokenAllowance) return true;
    const requiredAmount = parseUnits(testAmount, 18);
    return (tokenAllowance as bigint) < requiredAmount;
  };

  const handleApprove = async () => {
    if (!tokenAddress || !sushiV2Addresses?.router || !address) {
      addLog("❌ Missing required data for approval");
      return;
    }

    setStep(1);
    addLog("🟡 Starting approval process...");
    
    try {
      const amountToApprove = parseUnits("1000000", 18); // Large approval
      addLog(`📝 Approving ${formatEther(amountToApprove)} tokens for router ${sushiV2Addresses.router}`);
      
      await writeContract({
        address: tokenAddress,
        abi: CHAINCRAFT_TOKEN_ABI,
        functionName: 'approve',
        args: [sushiV2Addresses.router as Address, amountToApprove],
      });
    } catch (error: any) {
      addLog(`❌ Approval failed: ${error.message}`);
      setStep(0);
    }
  };

  const handleSell = async () => {
    if (!tokenAddress || !sushiV2Addresses?.router || !address) {
      addLog("❌ Missing required data for selling");
      return;
    }

    if (needsApproval()) {
      addLog("⚠️ Still need approval before selling");
      return;
    }

    setStep(2);
    addLog("🟢 Starting sell process...");
    
    try {
      const amountIn = parseUnits(testAmount, 18);
      const path = [tokenAddress, contractAddresses.WETH];
      
      // Calculate minimum amount out with 10% slippage
      let minAmountOut = 1n;
      if (sellQuote && Array.isArray(sellQuote) && sellQuote.length > 1) {
        const quoteOutput = sellQuote[1] as bigint;
        minAmountOut = (quoteOutput * 90n) / 100n; // 10% slippage
      }
      
      // Deadline: 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      
      addLog(`📊 Sell parameters:`);
      addLog(`  - Amount In: ${formatEther(amountIn)} ${tokenSymbol}`);
      addLog(`  - Min Amount Out: ${formatEther(minAmountOut)} CORE`);
      addLog(`  - Path: [${tokenAddress.slice(0,8)}..., ${contractAddresses.WETH.slice(0,8)}...]`);
      addLog(`  - Deadline: ${deadline}`);
      addLog(`  - Router: ${sushiV2Addresses.router}`);
      
      await writeContract({
        address: sushiV2Addresses.router as Address,
        abi: SUSHISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [amountIn, minAmountOut, path, address, deadline],
      });
    } catch (error: any) {
      addLog(`❌ Sell failed: ${error.message}`);
      addLog(`❌ Error details: ${JSON.stringify(error, null, 2)}`);
      setStep(0);
    }
  };

  // Handle transaction success
  React.useEffect(() => {
    if (isConfirmed && hash) {
      addLog(`✅ Transaction confirmed! Hash: ${hash}`);
      if (step === 1) {
        addLog("🔄 Approval complete, refetching allowance...");
        setTimeout(() => {
          refetchAllowance();
          setStep(0);
        }, 2000);
      } else if (step === 2) {
        addLog("🎉 Sell complete!");
        setStep(3);
      }
    }
  }, [isConfirmed, hash, step, refetchAllowance]);

  const clearLogs = () => {
    setDebugLogs([]);
    setStep(0);
  };

  if (!isConnected) {
    return (
      <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4">
        <p className="text-amber-300">🔌 Connect your wallet to debug selling</p>
      </div>
    );
  }

  if (!sushiV2Addresses) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-300">❌ SushiSwap not available on chain ID: {chainId}</p>
      </div>
    );
  }

  return (
    <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-red-200 mb-4">
        🔧 Sell Debug Tool for {tokenSymbol}
      </h3>
      
      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-800/30 p-4 rounded">
          <h4 className="text-red-300 font-medium mb-2">💰 Balance</h4>
          <p className="text-red-200 text-sm">
            {tokenBalance ? parseFloat(formatEther(tokenBalance as bigint)).toFixed(4) : '0.0000'} {tokenSymbol}
          </p>
        </div>
        
        <div className="bg-orange-800/30 p-4 rounded">
          <h4 className="text-orange-300 font-medium mb-2">🔐 Approval</h4>
          <p className={`text-sm ${needsApproval() ? 'text-red-300' : 'text-green-300'}`}>
            {needsApproval() ? '❌ Not Approved' : '✅ Approved'}
          </p>
          {tokenAllowance && (
            <p className="text-xs text-orange-200 mt-1">
              Allowance: {parseFloat(formatEther(tokenAllowance as bigint)).toFixed(2)}
            </p>
          )}
        </div>
        
        <div className="bg-purple-800/30 p-4 rounded">
          <h4 className="text-purple-300 font-medium mb-2">📊 Quote</h4>
          <p className="text-purple-200 text-sm">
            {sellQuote && Array.isArray(sellQuote) && sellQuote.length > 1
              ? `${parseFloat(formatEther(sellQuote[1] as bigint)).toFixed(6)} CORE`
              : 'No quote'
            }
          </p>
        </div>
      </div>

      {/* Test Controls */}
      <div className="mb-6">
        <label className="block text-red-300 text-sm mb-2">
          Test Amount ({tokenSymbol}):
        </label>
        <input
          type="number"
          value={testAmount}
          onChange={(e) => setTestAmount(e.target.value)}
          className="w-full p-2 bg-red-800/30 border border-red-600/50 rounded text-white"
          disabled={isPending || isConfirming || step > 0}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        {needsApproval() ? (
          <button
            onClick={handleApprove}
            disabled={isPending || isConfirming || step > 0}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-2 px-4 rounded font-medium transition-colors"
          >
            {step === 1 ? 'Approving...' : '1. Approve Tokens'}
          </button>
        ) : (
          <button
            onClick={handleSell}
            disabled={isPending || isConfirming || step > 0 || needsApproval()}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 px-4 rounded font-medium transition-colors"
          >
            {step === 2 ? 'Selling...' : '2. Sell Tokens'}
          </button>
        )}
        
        <button
          onClick={clearLogs}
          className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded font-medium transition-colors"
        >
          Clear Logs
        </button>
      </div>

      {/* Status Indicators */}
      {(isPending || isConfirming) && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <p className="text-blue-300 text-sm">
              {isPending ? 'Transaction pending...' : 'Confirming transaction...'}
            </p>
          </div>
        </div>
      )}

      {/* Debug Logs */}
      <div className="bg-black/30 rounded p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-red-300 font-medium">🔍 Debug Logs</h4>
          <span className="text-xs text-red-400">{debugLogs.length} entries</span>
        </div>
        <div className="text-xs text-red-200 font-mono space-y-1 max-h-64 overflow-auto">
          {debugLogs.length === 0 ? (
            <p className="text-red-400">No logs yet. Try performing an action above.</p>
          ) : (
            debugLogs.map((log, index) => (
              <div key={index} className="border-l-2 border-red-500/30 pl-2 py-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
        <h4 className="text-blue-300 font-medium mb-2">📋 Instructions</h4>
        <ol className="text-blue-200 text-sm space-y-1 list-decimal list-inside">
          <li>Enter the amount of {tokenSymbol} you want to test selling</li>
          <li>If not approved, click "Approve Tokens" first</li>
          <li>Wait for approval to complete, then click "Sell Tokens"</li>
          <li>Watch the debug logs for detailed information about what happens</li>
          <li>Any errors will be logged with full details</li>
        </ol>
      </div>
    </div>
  );
};

export default SellDebugger;
