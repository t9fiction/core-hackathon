import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useChainId,
  useWriteContract,
} from "wagmi";
import { formatEther, Address, formatUnits, parseUnits } from "viem";
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from '../lib/contracts/abis';
import { getContractAddresses } from "../lib/contracts/addresses";
import {
  useTokenDEX,
} from "../lib/hooks/useTokenContracts";
import { PUMPFUN_DEX_MANAGER_ABI } from '../lib/contracts/abis';
import { parseEther } from "viem";
import Link from "next/link";
import { showErrorAlert } from '../lib/swal-config';

interface TokenInfo {
  tokenAddress: string;
  creator: string;
  deploymentTime: bigint;
  name?: string;
  symbol?: string;
  totalSupply?: bigint;
  balance?: bigint;
}

const TokenManager = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const contractAddress = getContractAddresses(chainId).PUMPFUN_FACTORY;

  // Get all tokens created by the user
  const { data: creatorTokens } = useReadContract({
    address: contractAddress,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: "getTokensByCreator",
    args: address ? [address] : undefined,
  });

  // Get all deployed tokens
  const { data: allTokens } = useReadContract({
    address: contractAddress,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: "getAllDeployedTokens",
  });

  // Create a component for individual token data fetching
  const TokenDataFetcher = ({
    tokenAddress,
    onDataFetched,
  }: {
    tokenAddress: string;
    onDataFetched: (data: TokenInfo) => void;
  }) => {
    const [hasBeenFetched, setHasBeenFetched] = useState(false);

    // Get token info from factory contract
    const { data: tokenInfo } = useReadContract({
      address: contractAddress,
      abi: PUMPFUN_FACTORY_ABI,
      functionName: "getTokenInfo",
      args: [tokenAddress as Address],
    });

    // Get token details from the token contract
    const { data: tokenName } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: "name",
    });

    const { data: tokenSymbol } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: "symbol",
    });

    const { data: totalSupply } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: "totalSupply",
    });

    useEffect(() => {
      if (
        !hasBeenFetched &&
        tokenInfo &&
        tokenName &&
        tokenSymbol &&
        totalSupply !== undefined
      ) {
        const [creator, deploymentTime] =
          tokenInfo as [string, bigint];
        onDataFetched({
          tokenAddress,
          creator,
          deploymentTime,
          name: tokenName as string,
          symbol: tokenSymbol as string,
          totalSupply: totalSupply as bigint,
        });
        setHasBeenFetched(true);
      }
    }, [
      tokenInfo,
      tokenName,
      tokenSymbol,
      totalSupply,
      tokenAddress,
      hasBeenFetched,
      onDataFetched,
    ]);

    return null; // This component doesn't render anything
  };

  // Handle token data collection
  useEffect(() => {
    console.log("TokenManager: creatorTokens data:", creatorTokens);
    console.log("TokenManager: address:", address);
    console.log("TokenManager: chainId:", chainId);

    if (creatorTokens && creatorTokens.length > 0) {
      console.log(
        "TokenManager: Found creator tokens, preparing to fetch details..."
      );
      setLoading(true);
      setTokens([]); // Reset tokens array
    } else {
      console.log("TokenManager: No creator tokens found");
      setTokens([]);
      setLoading(false);
    }
  }, [creatorTokens, address, chainId]);

  // Compare TokenInfo objects without JSON.stringify
  const areTokenInfosEqual = (a: TokenInfo, b: TokenInfo): boolean => {
    return (
      a.tokenAddress === b.tokenAddress &&
      a.creator === b.creator &&
      a.deploymentTime.toString() === b.deploymentTime.toString() &&
      a.name === b.name &&
      a.symbol === b.symbol &&
      (a.totalSupply?.toString() || undefined) === (b.totalSupply?.toString() || undefined) &&
      (a.balance?.toString() || undefined) === (b.balance?.toString() || undefined)
    );
  };

  // Handle individual token data - memoized to prevent infinite re-renders
  const handleTokenDataFetched = useCallback((tokenData: TokenInfo) => {
    setTokens((prevTokens) => {
      // Check if token already exists to avoid duplicates
      const existingIndex = prevTokens.findIndex(
        (t) => t.tokenAddress === tokenData.tokenAddress
      );

      if (existingIndex >= 0) {
        // Check if the data has actually changed before updating
        const existingToken = prevTokens[existingIndex];
        const hasChanged = !areTokenInfosEqual(existingToken, tokenData);

        if (hasChanged) {
          // Update existing token only if data has changed
          const updatedTokens = [...prevTokens];
          updatedTokens[existingIndex] = tokenData;
          return updatedTokens;
        }
        // Return the same array if no changes to prevent re-render
        return prevTokens;
      } else {
        // Add new token
        return [...prevTokens, tokenData];
      }
    });
  }, []);

  // Check if all tokens have been loaded and stop loading
  useEffect(() => {
    if (creatorTokens && tokens.length > 0 && tokens.length === creatorTokens.length) {
      setLoading(false);
    }
  }, [tokens.length, creatorTokens]);

  const TokenCard = ({ token }: { token: TokenInfo }) => (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">
            {token.name || "Unknown Token"}
          </h3>
          <p className="text-gray-400">{token.symbol || "N/A"}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Total Supply</p>
          <p className="text-white font-medium">
            {token.totalSupply ? formatEther(token.totalSupply) : "N/A"}
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
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setSelectedToken(token.tokenAddress)}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm transition-colors"
        >
          Manage
        </button>
        <Link
          href={`https://sepolia.etherscan.io/token/${token.tokenAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <button className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer">
            View on Explorer
          </button>
        </Link>
      </div>
    </div>
  );

  const TokenManagement = ({ tokenAddress }: { tokenAddress: string }) => {
    const [activeTab, setActiveTab] = useState("dex");
    const [lockAmount, setLockAmount] = useState("");
    const [lockEthAmount, setLockEthAmount] = useState("");
    const [lockDuration, setLockDuration] = useState(30);
    const [lockDescription, setLockDescription] = useState("Team tokens locked to build community trust");
    const [isApproving, setIsApproving] = useState(false);
    const [needsApproval, setNeedsApproval] = useState(false);
    const [isLocking, setIsLocking] = useState(false);
    const [liquidityAmount, setLiquidityAmount] = useState("");
    const [ethAmount, setEthAmount] = useState("");
    const [poolTokenAmount, setPoolTokenAmount] = useState("");
    const [poolEthAmount, setPoolEthAmount] = useState("");
    const [poolFee, setPoolFee] = useState(3000);
    const [buyAmount, setBuyAmount] = useState("");
    const [sellAmount, setSellAmount] = useState("");

    const chainId = useChainId();
    const contractAddresses = getContractAddresses(chainId);

    // Get token price for estimates
    const { data: tokenPriceData } = useReadContract({
      address: contractAddresses.PUMPFUN_DEX_MANAGER,
      abi: PUMPFUN_DEX_MANAGER_ABI,
      functionName: 'getTokenPrice',
      args: [tokenAddress as Address],
      query: {
        enabled: !!tokenAddress
      }
    });

    // Get token details
    const selectedTokenInfo = tokens.find(
      (t) => t.tokenAddress === tokenAddress
    );

    // Initialize hooks for blockchain interactions
    const dex = useTokenDEX(tokenAddress as Address);
    const { writeContract } = useWriteContract();

    // Read token balance of the user
    const { data: tokenBalance } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [address as Address],
      query: {
        enabled: !!tokenAddress && !!address && isConnected,
      },
    });

    // Check if token is currently locked
    const { data: isCurrentlyLocked } = useReadContract({
      address: contractAddresses.PUMPFUN_FACTORY,
      abi: PUMPFUN_FACTORY_ABI,
      functionName: 'isTokenCurrentlyLocked',
      args: [tokenAddress as Address],
      query: {
        enabled: !!tokenAddress && !!contractAddresses.PUMPFUN_FACTORY,
      },
    });

    // Get existing lock info if any
    const { data: tokenLockInfo } = useReadContract({
      address: contractAddresses.PUMPFUN_FACTORY,
      abi: PUMPFUN_FACTORY_ABI,
      functionName: 'getTokenLock',
      args: [tokenAddress as Address],
      query: {
        enabled: !!tokenAddress && !!contractAddresses.PUMPFUN_FACTORY,
      },
    });

    // Check current allowance for token locking
    const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: 'allowance',
      args: [address as Address, contractAddresses.PUMPFUN_FACTORY as Address],
      query: {
        enabled: !!tokenAddress && !!address && !!contractAddresses.PUMPFUN_FACTORY && isConnected,
      },
    });

    // Check if approval is needed
    useEffect(() => {
      if (lockAmount && currentAllowance !== undefined) {
        const requestedAmount = parseUnits(lockAmount, 18);
        const allowance = currentAllowance as bigint;
        setNeedsApproval(requestedAmount > allowance);
      } else {
        setNeedsApproval(false);
      }
    }, [lockAmount, currentAllowance]);

    // Handle token approval for locking
    const handleApproveTokens = async () => {
      if (!lockAmount || !tokenAddress) return;
      
      try {
        setIsApproving(true);
        const tokenAmountWei = parseUnits(lockAmount, 18);
        
        await writeContract({
          address: tokenAddress as Address,
          abi: PUMPFUN_TOKEN_ABI,
          functionName: 'approve',
          args: [contractAddresses.PUMPFUN_FACTORY as Address, tokenAmountWei],
        });

        // Wait for approval and refetch allowance
        setTimeout(() => {
          refetchAllowance();
          setIsApproving(false);
        }, 3000);

      } catch (error) {
        console.error('Error approving tokens:', error);
        showErrorAlert(
          'Approval Failed',
          (error as any)?.message || 'Failed to approve tokens'
        );
        setIsApproving(false);
      }
    };

    // Handle token locking
    const handleLockTokens = async () => {
      try {
        setIsLocking(true);
        
        if (!tokenAddress) {
          throw new Error('Token address is required');
        }

        const tokenAmount = parseFloat(lockAmount);
        if (tokenAmount <= 0) {
          throw new Error('Token amount must be greater than 0');
        }

        const ethAmount = parseFloat(lockEthAmount);
        if (ethAmount <= 0) {
          throw new Error('ETH collateral amount must be greater than 0');
        }

        if (lockDuration < 1 || lockDuration > 365) {
          throw new Error('Lock duration must be between 1 and 365 days');
        }

        // Check if requested amount exceeds available balance
        if (tokenBalance) {
          const availableBalance = parseFloat(formatUnits(tokenBalance as bigint, 18));
          if (tokenAmount > availableBalance) {
            throw new Error(`Requested amount (${tokenAmount}) exceeds available balance (${availableBalance.toFixed(2)})`);
          }
        }

        const tokenAmountWei = parseUnits(lockAmount, 18);
        const ethAmountWei = parseEther(lockEthAmount);
        const lockDurationSeconds = lockDuration * 24 * 60 * 60;

        // Lock tokens
        await writeContract({
          address: contractAddresses.PUMPFUN_FACTORY as Address,
          abi: PUMPFUN_FACTORY_ABI,
          functionName: 'lockTokens',
          args: [
            tokenAddress as Address,
            tokenAmountWei,
            lockDurationSeconds,
            lockDescription || `Locked ${tokenAmount} ${selectedTokenInfo?.symbol} for ${lockDuration} days`
          ],
          value: ethAmountWei,
        });

        // Reset form after successful lock
        setLockAmount('');
        setLockEthAmount('');
        setLockDuration(30);
        setLockDescription('Team tokens locked to build community trust');
        setIsLocking(false);
        
        // Refetch data
        refetchAllowance();
        
      } catch (error) {
        console.error('Error locking tokens:', error);
        showErrorAlert(
          'Lock Failed', 
          (error as any)?.message || 'Failed to lock tokens'
        );
        setIsLocking(false);
      }
    };

    const tabs = [
      { id: "dex", label: "💱 DEX Trading", icon: "💱" },
      { id: "liquidity", label: "💧 Liquidity", icon: "💧" },
      { id: "trust-lock", label: "🔒 Trust Lock", icon: "🔒" },
    ];

    const dexHash = async () => {
      try {
        if (poolTokenAmount && poolEthAmount) {
          const result = await dex.createFactoryDEXPool(
            poolTokenAmount,
            poolEthAmount,
            poolFee
          );
          console.log("DEX Pool created successfully:", result);
        }
      } catch (error) {
        console.error("Error creating DEX pool:", error);
      }
    };

    const handleBuyTokens = async () => {
      if (!buyAmount || !tokenAddress) return;
      
      try {
        const amountIn = parseEther(buyAmount);
        await writeContract({
          address: contractAddresses.PUMPFUN_DEX_MANAGER,
          abi: PUMPFUN_DEX_MANAGER_ABI,
          functionName: 'swapExactETHForTokensWithSlippage',
          args: [tokenAddress as Address, 3000, 500n], // 5% slippage
          value: amountIn,
        });
        setBuyAmount('');
      } catch (error) {
        console.error('Error buying tokens:', error);
        showErrorAlert(
          'Transaction Failed',
          (error as any)?.message || 'Unknown error occurred while buying tokens'
        );
      }
    };

    const handleSellTokens = async () => {
      if (!sellAmount || !tokenAddress) return;
      
      try {
        // First approve tokens if needed
        const amountIn = parseEther(sellAmount);
        
        // Approve tokens to DEX Manager
        await writeContract({
          address: tokenAddress as Address,
          abi: PUMPFUN_TOKEN_ABI,
          functionName: 'approve',
          args: [contractAddresses.PUMPFUN_DEX_MANAGER, amountIn],
        });

        // Wait a bit for approval
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Execute sell
        await writeContract({
          address: contractAddresses.PUMPFUN_DEX_MANAGER,
          abi: PUMPFUN_DEX_MANAGER_ABI,
          functionName: 'swapExactTokensForETHWithSlippage',
          args: [tokenAddress as Address, 3000, amountIn, 500n], // 5% slippage
        });
        setSellAmount('');
      } catch (error) {
        console.error('Error selling tokens:', error);
        showErrorAlert(
          'Transaction Failed',
          (error as any)?.message || 'Unknown error occurred while selling tokens'
        );
      }
    };

    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mt-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-white">
              {selectedTokenInfo?.name || "Token"} Management
            </h3>
            <p className="text-gray-400 text-sm">
              {selectedTokenInfo?.symbol} • {tokenAddress.slice(0, 6)}...
              {tokenAddress.slice(-4)}
            </p>
          </div>
          <button
            onClick={() => setSelectedToken("")}
            className="bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded transition-colors"
          >
            ← Back to List
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-700 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-500 text-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-600"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "dex" && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Buy Tokens */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    💰 Buy Tokens
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        ETH Amount
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="0.1"
                      />
                    </div>
                    <div className="bg-gray-600 rounded p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">
                          You&apos;ll receive:
                        </span>
                        <span className="text-white font-medium">
                          ~{buyAmount && tokenPriceData ? 
                            ((parseFloat(buyAmount) * parseFloat(formatEther(parseEther('1')))) / parseFloat(formatEther(tokenPriceData[0] as bigint))).toFixed(2)
                            : '0'} {selectedTokenInfo?.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Price:</span>
                        <span>1 ETH = {tokenPriceData ? 
                          (parseFloat(formatEther(parseEther('1'))) / parseFloat(formatEther(tokenPriceData[0] as bigint))).toFixed(0)
                          : '0'} {selectedTokenInfo?.symbol}</span>
                      </div>
                    </div>
                    <button
                      disabled={!isConnected || !buyAmount}
                      onClick={handleBuyTokens}
                      className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-2 px-4 rounded transition-colors"
                    >
                      Buy Tokens
                    </button>
                  </div>
                </div>

                {/* Sell Tokens */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    💸 Sell Tokens
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Token Amount
                      </label>
                      <input
                        type="number"
                        value={sellAmount}
                        onChange={(e) => setSellAmount(e.target.value)}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="1000"
                      />
                    </div>
                    <div className="bg-gray-600 rounded p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">
                          You&apos;ll receive:
                        </span>
                        <span className="text-white font-medium">
                          ~{sellAmount && tokenPriceData ? 
                            ((parseFloat(sellAmount) * parseFloat(formatEther(tokenPriceData[0] as bigint))) / parseFloat(formatEther(parseEther('1')))).toFixed(6)
                            : '0'} ETH
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Price:</span>
                        <span>
                          1 {selectedTokenInfo?.symbol} = {tokenPriceData ? 
                            (parseFloat(formatEther(tokenPriceData[0] as bigint)) / parseFloat(formatEther(parseEther('1')))).toFixed(8)
                            : '0'} ETH
                        </span>
                      </div>
                    </div>
                    <button
                      disabled={!isConnected || !sellAmount}
                      onClick={handleSellTokens}
                      className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-2 px-4 rounded transition-colors"
                    >
                      Sell Tokens
                    </button>
                  </div>
                </div>
              </div>

              {/* Trading Stats */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3">
                  📊 Trading Statistics
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Price</p>
                    <p className="text-white font-bold">$0.00081</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">24h Volume</p>
                    <p className="text-white font-bold">$12,450</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Market Cap</p>
                    <p className="text-white font-bold">$405K</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Liquidity</p>
                    <p className="text-white font-bold">$89K</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "liquidity" && (
            <div className="space-y-6">
              {/* Conditional Pool Creation */}
              {!dex.poolExists ? (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    🚀 Create DEX Pool
                    <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
                      Uniswap V3
                    </span>
                  </h4>
                  <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded">
                    <p className="text-blue-200 text-sm">
                      ℹ️ No liquidity pool exists for this token yet. Create one to enable trading on Uniswap.
                    </p>
                  </div>
                  {dex.error && (
                    <div className="text-red-400 text-sm mb-4 p-2 bg-red-900/30 border border-red-500/50 rounded">
                      {dex.error}
                    </div>
                  )}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Token Amount
                      </label>
                      <input
                        type="number"
                        value={poolTokenAmount}
                        onChange={(e) => setPoolTokenAmount(e.target.value)}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="5000"
                      />
                      <p className="text-xs text-gray-400 mt-1">Initial tokens for the pool</p>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        ETH Amount
                      </label>
                      <input
                        type="number"
                        value={poolEthAmount}
                        onChange={(e) => setPoolEthAmount(e.target.value)}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="1.0"
                        step="0.01"
                      />
                      <p className="text-xs text-gray-400 mt-1">Initial ETH for the pool</p>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Fee Tier
                      </label>
                      <select
                        value={poolFee}
                        onChange={(e) => setPoolFee(Number(e.target.value))}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                      >
                        <option value={500}>0.05% (Low)</option>
                        <option value={3000}>0.3% (Standard)</option>
                        <option value={10000}>1% (High)</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Swap fee percentage</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-gray-600 rounded">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Pool Pair:</span>
                        <span className="text-white font-medium">
                          {selectedTokenInfo?.symbol || 'TOKEN'}/ETH
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Fee Tier:</span>
                        <span className="text-white">{poolFee / 10000}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Initial Price:</span>
                        <span className="text-white">
                          {poolTokenAmount && poolEthAmount
                            ? `1 ETH = ${(
                                Number(poolTokenAmount) / Number(poolEthAmount)
                              ).toFixed(2)} ${selectedTokenInfo?.symbol}`
                            : "Enter amounts"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={dexHash}
                    disabled={
                      !isConnected ||
                      !poolTokenAmount ||
                      !poolEthAmount ||
                      dex.isCreatingPool
                    }
                    className="w-full mt-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white py-3 px-4 rounded transition-colors font-medium"
                  >
                    {dex.isCreatingPool ? (
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
                        Creating DEX Pool...
                      </span>
                    ) : (
                      "Create DEX Pool on Uniswap"
                    )}
                  </button>
                </div>
              ) : (
                /* Pool exists - Show liquidity management */
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Add Liquidity to Existing Pool */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                      💧 Add Liquidity
                      <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">
                        Pool Active
                      </span>
                    </h4>
                    {dex.error && (
                      <div className="text-red-400 text-sm mb-4 p-2 bg-red-900/30 border border-red-500/50 rounded">
                        {dex.error}
                      </div>
                    )}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">
                          Token Amount
                        </label>
                        <input
                          type="number"
                          value={liquidityAmount}
                          onChange={(e) => setLiquidityAmount(e.target.value)}
                          className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                          placeholder="10000"
                        />
                        <p className="text-xs text-gray-400 mt-1">Your {selectedTokenInfo?.symbol} tokens</p>
                      </div>
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">
                          ETH Amount
                        </label>
                        <input
                          type="number"
                          value={ethAmount}
                          onChange={(e) => setEthAmount(e.target.value)}
                          className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                          placeholder="1.0"
                          step="0.01"
                        />
                        <p className="text-xs text-gray-400 mt-1">ETH to provide as liquidity</p>
                      </div>
                      <div className="bg-gray-600 rounded p-3">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-300">Current Pool Ratio:</span>
                            <span className="text-white">~1 ETH : 12,340 {selectedTokenInfo?.symbol}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">LP Tokens to Receive:</span>
                            <span className="text-green-400">~0.05 LP</span>
                          </div>
                        </div>
                      </div>
                      <button
                        disabled={
                          !isConnected ||
                          !liquidityAmount ||
                          !ethAmount
                        }
                        onClick={async () => {
                          try {
                            await dex.addLiquidity(
                              liquidityAmount,
                              ethAmount,
                              poolFee
                            );
                          } catch (error) {
                            console.error("Error adding liquidity:", error);
                          }
                        }}
                        className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-2 px-4 rounded transition-colors"
                      >
                        Add Liquidity
                      </button>
                    </div>
                  </div>

                  {/* Pool Information */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-3">
                      📊 Pool Information
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Pool Status:</span>
                        <span className="text-green-400 font-medium flex items-center">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                          Active
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Total Liquidity:</span>
                        <span className="text-white font-medium">
                          Loading...
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">My Position:</span>
                        <span className="text-white font-medium">
                          No position
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Pool Share:</span>
                        <span className="text-white font-medium">
                          0%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Fee Tier:</span>
                        <span className="text-white font-medium">{poolFee / 10000}%</span>
                      </div>
                      <div className="pt-3 border-t border-gray-600">
                        <div className="p-3 bg-orange-900/30 border border-orange-500/50 rounded-lg mb-3">
                          <div className="text-orange-200 text-sm">
                            <div className="font-medium mb-1 text-orange-300">🔒 Permanent Liquidity Lock</div>
                            <p className="text-xs">
                              Liquidity is permanently locked and cannot be removed (roach motel model). This ensures long-term price stability.
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`https://app.uniswap.org/pools/${tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full"
                        >
                          <button className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 px-4 rounded transition-colors">
                            View on Uniswap
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "trust-lock" && (
            <div className="space-y-6">
              {/* Trust Lock Information Banner */}
              <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🔒</div>
                  <div>
                    <h3 className="text-blue-200 font-semibold mb-2">Trust Lock Mechanism</h3>
                    <p className="text-blue-200 text-sm">
                      Lock your tokens with ETH commitment to demonstrate long-term commitment to your community. 
                      This builds investor confidence by showing you won't dump tokens and run away.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Lock Tokens Form */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                    🔐 Create Trust Lock
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Token Amount to Lock
                      </label>
                      <input
                        type="number"
                        value={lockAmount}
                        onChange={(e) => setLockAmount(e.target.value)}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="10000"
                      />
                      <p className="text-xs text-gray-400 mt-1">Amount of {selectedTokenInfo?.symbol} tokens to lock</p>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        ETH Collateral Amount
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={lockEthAmount}
                        onChange={(e) => setLockEthAmount(e.target.value)}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="0.1"
                      />
                      <p className="text-xs text-gray-400 mt-1">ETH required as collateral for the lock (shows commitment)</p>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Lock Duration (days)
                      </label>
                      <input
                        type="number"
                        value={lockDuration}
                        onChange={(e) => setLockDuration(Number(e.target.value))}
                        min="1"
                        max="365"
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">How long to lock tokens (1-365 days)</p>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Description (Optional)
                      </label>
                      <input
                        type="text"
                        value={lockDescription}
                        onChange={(e) => setLockDescription(e.target.value)}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="Team tokens locked to build community trust"
                      />
                      <p className="text-xs text-gray-400 mt-1">Public description for the community</p>
                    </div>
                    <div className="bg-gray-600 rounded p-3">
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Unlock Date:</span>
                          <span className="text-white">
                            {new Date(Date.now() + lockDuration * 24 * 60 * 60 * 1000).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Tokens to Lock:</span>
                          <span className="text-green-400 font-medium">
                            {lockAmount} {selectedTokenInfo?.symbol}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">ETH Collateral:</span>
                          <span className="text-yellow-400 font-medium">
                            {lockEthAmount} ETH
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Approval Status Display */}
                    {lockAmount && currentAllowance !== undefined && (
                      <div className="p-3 bg-gray-600 rounded mb-3">
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-300">Current Allowance:</span>
                            <span className="text-white">{parseFloat(formatUnits(currentAllowance as bigint, 18)).toFixed(2)} {selectedTokenInfo?.symbol}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Requested Amount:</span>
                            <span className="text-white">{lockAmount} {selectedTokenInfo?.symbol}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Approval Status:</span>
                            <span className={`${needsApproval ? 'text-orange-400' : 'text-green-400'}`}>
                              {needsApproval ? '⚠️ Approval Required' : '✅ Approved'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Approve/Lock Button Flow */}
                    {needsApproval ? (
                      <button
                        disabled={!isConnected || !lockAmount || !lockEthAmount || !lockDuration || isApproving || (isCurrentlyLocked === true)}
                        onClick={handleApproveTokens}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white py-2 px-4 rounded transition-colors font-medium mb-2"
                      >
                        {isApproving ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Approving Tokens...
                          </span>
                        ) : (
                          `📝 Step 1: Approve ${lockAmount} ${selectedTokenInfo?.symbol}`
                        )}
                      </button>
                    ) : (
                      <button
                        disabled={!isConnected || !lockAmount || !lockEthAmount || !lockDuration || isLocking || (isCurrentlyLocked === true)}
                        onClick={handleLockTokens}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 text-white py-2 px-4 rounded transition-colors font-medium"
                      >
                        {isLocking ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Locking Tokens...
                          </span>
                        ) : isCurrentlyLocked ? (
                          'Token Already Locked'
                        ) : (
                          '🔐 Step 2: Lock Tokens'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Current Lock Status */}
                {tokenLockInfo && (tokenLockInfo as any).isActive && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                      🔒 Current Token Lock
                    </h4>
                    <div className="p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/50 rounded-lg">
                      <div className="text-yellow-200 text-sm">
                        <div className="font-medium mb-2 text-yellow-300">🔒 Token Currently Locked:</div>
                        <ul className="text-xs space-y-1">
                          <li>Amount: {formatUnits((tokenLockInfo as any).tokenAmount, 18)} {selectedTokenInfo?.symbol}</li>
                          <li>Lock Duration: {Math.floor(Number((tokenLockInfo as any).lockDuration) / (24 * 60 * 60))} days</li>
                          <li>Description: {(tokenLockInfo as any).description}</li>
                          <li>Unlock Time: {new Date(Number((tokenLockInfo as any).unlockTime) * 1000).toLocaleDateString()}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* No Lock Display */}
                {!tokenLockInfo || !(tokenLockInfo as any).isActive && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                      🔒 Token Lock Status
                    </h4>
                    <div className="text-center text-gray-400 text-sm py-8">
                      <div className="text-4xl mb-2">🔓</div>
                      <p>No active token lock</p>
                      <p className="text-xs mt-1">Create a lock to build community trust</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Community Trust Stats */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                  📊 Token Lock Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Lock Status</p>
                    <p className="text-white font-bold">
                      {(tokenLockInfo && (tokenLockInfo as any).isActive) ? '🔒 Locked' : '🔓 Unlocked'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Trust Score</p>
                    <p className="text-green-400 font-bold">
                      {(tokenLockInfo && (tokenLockInfo as any).isActive) ? '🔒 High' : '⚠️ Low'}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Connect Your Wallet
          </h2>
          <p className="text-gray-400">
            Please connect your wallet to view your tokens
          </p>
        </div>
      </div>
    );
  }

  if (chainId !== 11155111) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Unsupported Network</h2>
          <p className="text-gray-400">
            Please switch to the Sepolia testnet to use this feature.
          </p>
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

        {/* Hidden TokenDataFetcher components for each creator token */}
        {creatorTokens &&
          creatorTokens.map((tokenAddress) => (
            <TokenDataFetcher
              key={`${tokenAddress}-${creatorTokens.length}`}
              tokenAddress={tokenAddress as string}
              onDataFetched={handleTokenDataFetched}
            />
          ))}

{tokens.length > 0 && (
  <div className="mb-6">
    <label className="block text-gray-300 text-sm mb-1">Select a Token</label>
    <select
      value={selectedToken}
      onChange={(e) => setSelectedToken(e.target.value)}
      className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
    >
      <option value="">-- Select a Token --</option>
      {tokens.map((token) => (
        <option key={token.tokenAddress} value={token.tokenAddress}>
          {token.name || "Unknown Token"}
        </option>
      ))}
    </select>
  </div>
)}

{selectedToken ? (
  <TokenManagement tokenAddress={selectedToken} />
) : (
  <>
    {loading ? (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⏳</div>
        <h3 className="text-xl font-bold text-white mb-2">
          Loading Tokens...
        </h3>
        <p className="text-gray-400 mb-6">
          Fetching your token details from the blockchain
        </p>
      </div>
    ) : tokens.length === 0 ? (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🪙</div>
        <h3 className="text-xl font-bold text-white mb-2">
          No Tokens Found
        </h3>
        <p className="text-gray-400 mb-6">
          You haven&apos;t deployed any tokens yet
        </p>
        <button
          onClick={() => (window.location.href = "/deploy")}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-6 rounded-lg transition-colors"
        >
          Deploy Your First Token
        </button>
      </div>
    ) : null}
  </>
)}

        {allTokens && allTokens.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">
              All Deployed Tokens
            </h2>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <p className="text-gray-300">
                Total tokens deployed on the platform:{" "}
                <span className="text-blue-400 font-bold">
                  {allTokens.length}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenManager;