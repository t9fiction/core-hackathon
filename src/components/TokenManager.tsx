import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useChainId,
  useWriteContract,
} from "wagmi";
import { formatEther, Address } from "viem";
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from "../lib/contracts/abis";
import { getContractAddresses } from "../lib/contracts/addresses";
import {
  useTokenGovernance,
  useTokenDEX,
  useTokenLock,
} from "../lib/hooks/useTokenContracts";
import Link from "next/link";

interface TokenInfo {
  tokenAddress: string;
  creator: string;
  deploymentTime: bigint;
  liquidityLockPeriodDays: bigint;
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

  useEffect(() => {
    console.log("TokenManager: creatorTokens data:", creatorTokens);
    console.log("TokenManager: address:", address);
    console.log("TokenManager: chainId:", chainId);

    if (creatorTokens && creatorTokens.length > 0) {
      console.log("TokenManager: Found creator tokens, fetching details...");
      setLoading(true);
      const fetchTokenDetails = async () => {
        const tokenDetails: TokenInfo[] = [];

        for (const tokenAddress of creatorTokens) {
          try {
            console.log(
              "TokenManager: Fetching details for token:",
              tokenAddress
            );
            // Call the API endpoint to get token info
            const response = await fetch(
              `/api/token-info?address=${tokenAddress}`
            );

            if (!response.ok) {
              // If API fails, create a basic token info object
              console.warn(
                `Failed to fetch details for token ${tokenAddress}:`,
                response.status,
                response.statusText
              );
              tokenDetails.push({
                tokenAddress: tokenAddress as string,
                creator: address as string,
                deploymentTime: BigInt(0),
                liquidityLockPeriodDays: BigInt(30),
                name: "Unknown Token",
                symbol: "UNK",
                totalSupply: BigInt(0),
              });
              continue;
            }

            const tokenInfo = await response.json();
            console.log("TokenManager: Token info received:", tokenInfo);
            tokenDetails.push({
              tokenAddress: tokenAddress as string,
              creator: tokenInfo.creator || address as string,
              deploymentTime: tokenInfo.deploymentTime ? BigInt(tokenInfo.deploymentTime) : BigInt(Math.floor(Date.now() / 1000)),
              liquidityLockPeriodDays: tokenInfo.liquidityLockPeriodDays ? BigInt(
                tokenInfo.liquidityLockPeriodDays
              ) : BigInt(30),
              name: tokenInfo.name || "Unknown Token",
              symbol: tokenInfo.symbol || "UNK",
              totalSupply: tokenInfo.totalSupply ? BigInt(tokenInfo.totalSupply) : BigInt(0),
            });
          } catch (error) {
            console.error("Error fetching token details:", error);
            // Add a fallback token entry
            tokenDetails.push({
              tokenAddress: tokenAddress as string,
              creator: address as string,
              deploymentTime: BigInt(Math.floor(Date.now() / 1000)),
              liquidityLockPeriodDays: BigInt(30),
              name: "Error Loading Token",
              symbol: "ERR",
              totalSupply: BigInt(0),
            });
          }
        }

        console.log("TokenManager: Final token details:", tokenDetails);
        setTokens(tokenDetails);
        setLoading(false);
      };

      fetchTokenDetails();
    } else {
      console.log("TokenManager: No creator tokens found");
      setTokens([]);
      setLoading(false);
    }
  }, [creatorTokens, address, chainId]);

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
        <div className="flex justify-between">
          <span className="text-gray-400">Lock Period:</span>
          <span className="text-white">
            {token.liquidityLockPeriodDays.toString()} days
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
        <button className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg text-sm transition-colors">
          <Link
            href={`https://sepolia.etherscan.io/token/${token.tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Explorer
          </Link>
        </button>
      </div>
    </div>
  );

  const TokenManagement = ({ tokenAddress }: { tokenAddress: string }) => {
    const [activeTab, setActiveTab] = useState("governance");
    const [lockAmount, setLockAmount] = useState("");
    const [lockDuration, setLockDuration] = useState(30);
    const [liquidityAmount, setLiquidityAmount] = useState("");
    const [ethAmount, setEthAmount] = useState("");
    const [proposalDescription, setProposalDescription] = useState("");
    const [proposalType, setProposalType] = useState(1);
    const [proposedValue, setProposedValue] = useState("");
    const [buyEthAmount, setBuyEthAmount] = useState("");
    const [sellTokenAmount, setSellTokenAmount] = useState("");
    const [poolTokenAmount, setPoolTokenAmount] = useState("");
    const [poolEthAmount, setPoolEthAmount] = useState("");
    const [poolFee, setPoolFee] = useState(3000);

    const chainId = useChainId();
    const contractAddresses = getContractAddresses(chainId);

    // Get token details
    const selectedTokenInfo = tokens.find(
      (t) => t.tokenAddress === tokenAddress
    );

    // Initialize hooks for blockchain interactions
    const governance = useTokenGovernance(tokenAddress as Address);
    const dex = useTokenDEX(tokenAddress as Address);
    const lock = useTokenLock(tokenAddress as Address);

    const tabs = [
      { id: "governance", label: "🏛️ Governance", icon: "🏛️" },
      { id: "dex", label: "💱 DEX Trading", icon: "💱" },
      { id: "liquidity", label: "💧 Liquidity", icon: "💧" },
      { id: "lock", label: "🔐 Token Lock", icon: "🔐" },
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
          {activeTab === "governance" && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Create Proposal */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    Create Proposal
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Proposal Type
                      </label>
                      <select
                        value={proposalType}
                        onChange={(e) =>
                          setProposalType(Number(e.target.value))
                        }
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                      >
                        <option value={1}>Update Max Transfer</option>
                        <option value={2}>Update Max Holding</option>
                        <option value={3}>Toggle Transfer Limits</option>
                        <option value={4}>Execute Airdrop</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Description
                      </label>
                      <textarea
                        value={proposalDescription}
                        onChange={(e) => setProposalDescription(e.target.value)}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        rows={3}
                        placeholder="Describe your proposal..."
                      />
                    </div>
                    {proposalType !== 4 && (
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">
                          Proposed Value
                        </label>
                        <input
                          type="number"
                          value={proposedValue}
                          onChange={(e) => setProposedValue(e.target.value)}
                          className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                          placeholder="Enter value"
                        />
                      </div>
                    )}
                    <button
                      disabled={!isConnected}
                      className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white py-2 px-4 rounded transition-colors"
                    >
                      Create Proposal
                    </button>
                  </div>
                </div>

                {/* Active Proposals */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    Active Proposals
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-gray-600 rounded p-3">
                      <p className="text-sm text-white mb-2">
                        Update transfer cooldown
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">
                          Proposal #1
                        </span>
                        <div className="flex gap-1">
                          <button className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs">
                            Vote Yes
                          </button>
                          <button className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">
                            Vote No
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>For: 1,250 votes</span>
                          <span>Against: 300 votes</span>
                        </div>
                        <div className="w-full bg-gray-500 rounded-full h-2 mt-1">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: "80%" }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-gray-400 text-sm py-4">
                      No other active proposals
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="0.1"
                      />
                    </div>
                    <div className="bg-gray-600 rounded p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">You'll receive:</span>
                        <span className="text-white font-medium">
                          ~1,234 {selectedTokenInfo?.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Price:</span>
                        <span>1 ETH = 12,340 {selectedTokenInfo?.symbol}</span>
                      </div>
                    </div>
                    <button
                      disabled={!isConnected}
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
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="1000"
                      />
                    </div>
                    <div className="bg-gray-600 rounded p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">You'll receive:</span>
                        <span className="text-white font-medium">
                          ~0.081 ETH
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Price:</span>
                        <span>
                          1 {selectedTokenInfo?.symbol} = 0.000081 ETH
                        </span>
                      </div>
                    </div>
                    <button
                      disabled={!isConnected}
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
              {/* Create DEX Pool Section */}
              <div className="bg-gray-700 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                  🚀 Create DEX Pool
                  <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
                    Factory Function
                  </span>
                </h4>
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
                      <option value={500}>0.05% (500)</option>
                      <option value={3000}>0.3% (3000)</option>
                      <option value={10000}>1% (10000)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-gray-600 rounded">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Pool Type:</span>
                      <span className="text-white">
                        Token/{selectedTokenInfo?.symbol} - ETH
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
                    "Create DEX Pool"
                  )}
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Add Liquidity */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    Add Liquidity
                  </h4>
                  {dex.error && (
                    <div className="text-red-400 text-sm mb-4">{dex.error}</div>
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
                    </div>
                    <button
                      disabled={
                        !isConnected ||
                        !dex.poolInfo ||
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

                {/* Liquidity Pool Info */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    Pool Information
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Pool Status:</span>
                      <span className="text-green-400 font-medium">Active</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Total Liquidity:</span>
                      <span className="text-white font-medium">$89,450</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">My Share:</span>
                      <span className="text-white font-medium">2.3%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Lock Period:</span>
                      <span className="text-yellow-400 font-medium">
                        28 days remaining
                      </span>
                    </div>
                    <button
                      disabled={!isConnected}
                      className="w-full bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white py-2 px-4 rounded transition-colors mt-3"
                    >
                      <Link href={`https://sepolia.etherscan.io/tx/${dexHash}`}>
                        View Pool on DEX
                      </Link>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "lock" && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Lock Tokens */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    Lock Tokens
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Amount to Lock
                      </label>
                      <input
                        type="number"
                        value={lockAmount}
                        onChange={(e) => setLockAmount(e.target.value)}
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                        placeholder="Enter amount"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">
                        Duration (days)
                      </label>
                      <input
                        type="number"
                        value={lockDuration}
                        onChange={(e) =>
                          setLockDuration(Number(e.target.value))
                        }
                        min="1"
                        max="365"
                        className="w-full p-2 rounded bg-gray-600 border border-gray-500 text-white"
                      />
                    </div>
                    <button
                      disabled={!isConnected}
                      className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white py-2 px-4 rounded transition-colors"
                    >
                      Lock Tokens
                    </button>
                  </div>
                </div>

                {/* Locked Tokens Info */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">
                    Locked Tokens
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-gray-600 rounded p-3">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Locked Amount:</span>
                        <span className="text-white font-medium">
                          50,000 {selectedTokenInfo?.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-300">Unlock Date:</span>
                        <span className="text-yellow-400 font-medium">
                          Jan 15, 2025
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-300">Days Remaining:</span>
                        <span className="text-white font-medium">45 days</span>
                      </div>
                    </div>
                    <div className="text-center text-gray-400 text-sm py-2">
                      No other locked positions
                    </div>
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

        {selectedToken ? (
          <TokenManagement tokenAddress={selectedToken} />
        ) : (
          <>
            {tokens.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🪙</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  No Tokens Found
                </h3>
                <p className="text-gray-400 mb-6">
                  You haven't deployed any tokens yet
                </p>
                <button
                  onClick={() => (window.location.href = "/deploy")}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-6 rounded-lg transition-colors"
                >
                  Deploy Your First Token
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tokens.map((token) => (
                  <TokenCard key={token.tokenAddress} token={token} />
                ))}
              </div>
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
          </>
        )}
      </div>
    </div>
  );
};

export default TokenManager;
