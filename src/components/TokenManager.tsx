import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useChainId,
  useWriteContract,
} from "wagmi";
import { formatEther, Address, formatUnits, parseUnits } from "viem";
import { CHAINCRAFT_FACTORY_ABI, CHAINCRAFT_TOKEN_ABI } from '../lib/contracts/abis';
import { getContractAddresses } from "../lib/contracts/addresses";
import {
  useTokenDEX,
} from "../lib/hooks/useTokenContracts";
import { CHAINCRAFT_DEX_MANAGER_ABI } from '../lib/contracts/abis';
import { parseEther } from "viem";
import Link from "next/link";
import { showErrorAlert } from '../lib/swal-config';
import { useTokenApproval } from '../lib/hooks/useTokenApproval';
import BuySellTokens from './BuySellTokens/BuySellTokens';

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

  const contractAddress = getContractAddresses(chainId).CHAINCRAFT_FACTORY;

  // Get all tokens created by the user
  const { data: creatorTokens } = useReadContract({
    address: contractAddress,
    abi: CHAINCRAFT_FACTORY_ABI,
    functionName: "getTokensByCreator",
    args: address ? [address] : undefined,
  });

  // Get all deployed tokens
  const { data: allTokens } = useReadContract({
    address: contractAddress,
    abi: CHAINCRAFT_FACTORY_ABI,
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
      abi: CHAINCRAFT_FACTORY_ABI,
      functionName: "getTokenInfo",
      args: [tokenAddress as Address],
    });

    // Get token details from the token contract
    const { data: tokenName } = useReadContract({
      address: tokenAddress as Address,
      abi: CHAINCRAFT_TOKEN_ABI,
      functionName: "name",
    });

    const { data: tokenSymbol } = useReadContract({
      address: tokenAddress as Address,
      abi: CHAINCRAFT_TOKEN_ABI,
      functionName: "symbol",
    });

    const { data: totalSupply } = useReadContract({
      address: tokenAddress as Address,
      abi: CHAINCRAFT_TOKEN_ABI,
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
          href={chainId === 1114 ? `https://scan.test2.btcs.network/address/${token.tokenAddress}` : `https://sepolia.etherscan.io/token/${token.tokenAddress}`}
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
    const [isLocking, setIsLocking] = useState(false);
    const [liquidityAmount, setLiquidityAmount] = useState("");
    const [ethAmount, setEthAmount] = useState("");
    const [poolTokenAmount, setPoolTokenAmount] = useState("");
    const [poolEthAmount, setPoolEthAmount] = useState("");
    const [poolFee, setPoolFee] = useState(3000);

    const chainId = useChainId();
    const contractAddresses = getContractAddresses(chainId);

    // Note: Token price calculation would need to be implemented separately
    // as the current DEX Manager doesn't have a getTokenPrice function
    const tokenPriceData = null;

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
      abi: CHAINCRAFT_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [address as Address],
      query: {
        enabled: !!tokenAddress && !!address && isConnected,
      },
    });

    // Check if token is currently locked
    const { data: isCurrentlyLocked } = useReadContract({
      address: contractAddresses.CHAINCRAFT_FACTORY,
      abi: CHAINCRAFT_FACTORY_ABI,
      functionName: 'isTokenCurrentlyLocked',
      args: [tokenAddress as Address],
      query: {
        enabled: !!tokenAddress && !!contractAddresses.CHAINCRAFT_FACTORY,
      },
    });

    // Get existing lock info if any
    const { data: tokenLockInfo } = useReadContract({
      address: contractAddresses.CHAINCRAFT_FACTORY,
      abi: CHAINCRAFT_FACTORY_ABI,
      functionName: 'getTokenLock',
      args: [tokenAddress as Address],
      query: {
        enabled: !!tokenAddress && !!contractAddresses.CHAINCRAFT_FACTORY,
      },
    });

    // Universal approval hook for token locking
    const {
      needsApproval,
      approve: approveTokensForLocking,
      approvalPending: isApproving,
      approvalSuccess,
      approvalError,
      spenderName: lockSpenderName,
    } = useTokenApproval({
      tokenAddress: tokenAddress as Address,
      spenderAddress: contractAddresses.CHAINCRAFT_FACTORY,
      userAddress: address,
      amount: lockAmount || '0',
      decimals: 18,
      enableMaxApproval: true, // Better UX - approve max amount for token locking
    });

    // Handle token locking with universal approval
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

        // Check if approval is needed first
        if (needsApproval) {
          await approveTokensForLocking();
          return; // Wait for approval success
        }

        // If approval complete, proceed with locking
        const tokenAmountWei = parseUnits(lockAmount, 18);
        const ethAmountWei = parseEther(lockEthAmount);
        const lockDurationSeconds = lockDuration * 24 * 60 * 60;

        // Lock tokens
        await writeContract({
          address: contractAddresses.CHAINCRAFT_FACTORY as Address,
          abi: CHAINCRAFT_FACTORY_ABI,
          functionName: 'lockTokens',
          args: [
            tokenAddress as Address,
            tokenAmountWei,
            BigInt(lockDurationSeconds),
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
        
      } catch (error) {
        console.error('Error locking tokens:', error);
        showErrorAlert(
          'Lock Failed', 
          (error as any)?.message || 'Failed to lock tokens'
        );
        setIsLocking(false);
      }
    };
    
    // Auto-proceed to lock after approval success
    useEffect(() => {
      if (approvalSuccess && lockAmount && lockEthAmount) {
        // Re-trigger lock after approval
        setTimeout(() => handleLockTokens(), 1000);
      }
    }, [approvalSuccess, lockAmount, lockEthAmount]);

    const tabs = [
      { id: "dex", label: "💱 Trading", icon: "💱" },
      { id: "trust-lock", label: "🔒 Trust Lock", icon: "🔒" },
    ];

    // Authorization for DEX trading (if needed in the future)
    const handleAuthorizeForDEX = async () => {
      try {
        await dex.authorizeTokenForTrading();
        console.log("Token authorized for DEX trading successfully");
      } catch (error) {
        console.error("Error authorizing token for DEX:", error);
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
              {/* Modern BuySellTokens Component */}
              <BuySellTokens 
                tokenAddress={tokenAddress as Address}
                tokenName={selectedTokenInfo?.name}
                tokenSymbol={selectedTokenInfo?.symbol}
                embedded={true}
                onTransactionComplete={() => {
                  console.log('Token trade completed successfully');
                }}
              />
            </div>
          )}

          {/* Liquidity tab removed - use SushiSwap V2 directly */}

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
                    {/* Universal approval status display */}
                    {(isApproving || approvalError) && (
                      <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg mb-3">
                        <div className="flex items-center gap-2">
                          {isApproving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                          ) : (
                            <div className="text-red-400">❌</div>
                          )}
                          <p className="text-blue-300 text-sm">
                            {isApproving ? `Approving tokens with ${lockSpenderName}...` : 
                             approvalError ? `Approval failed: ${approvalError}` :
                             'Processing approval...'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Universal Lock Button */}
                    <button
                      disabled={!isConnected || !lockAmount || !lockEthAmount || !lockDuration || isApproving || isLocking || (isCurrentlyLocked === true)}
                      onClick={handleLockTokens}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 text-white py-2 px-4 rounded transition-colors font-medium"
                    >
                      {isApproving || isLocking ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {isApproving ? 'Approving...' : 'Locking...'}
                        </span>
                      ) : isCurrentlyLocked ? (
                        'Token Already Locked'
                      ) : (
                        `🔐 Lock ${lockAmount} ${selectedTokenInfo?.symbol}`
                      )}
                    </button>
                    
                    {/* Help text */}
                    <div className="text-xs text-slate-400 text-center mt-2">
                      {needsApproval ? 
                        'Token approval will be handled automatically when you lock.' :
                        'Ready to lock - no approval needed.'
                      }
                    </div>
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

  // Support both Sepolia (11155111) and Core testnet2 (1114)
  const supportedChains = [11155111, 1116];
  const networkNames = {
    11155111: 'Sepolia',
    1114: 'Core DAO'
  };
  
  if (!supportedChains.includes(chainId)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Unsupported Network</h2>
          <p className="text-gray-400 mb-4">
            Please switch to a supported network to use this feature.
          </p>
          <div className="text-sm text-gray-500">
            <p>Supported networks:</p>
            <ul className="mt-2 space-y-1">
              <li>• Sepolia Testnet</li>
              <li>• Core Testnet2</li>
            </ul>
          </div>
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