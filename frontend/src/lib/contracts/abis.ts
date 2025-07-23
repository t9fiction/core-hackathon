// Contract ABIs for PumpFun Ecosystem
export const PUMPFUN_FACTORY_ABI = [
  // Token Deployment
  {
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "totalSupply", type: "uint256" },
      { name: "liquidityLockPeriodDays", type: "uint256" }
    ],
    name: "deployToken",
    outputs: [{ name: "tokenAddress", type: "address" }],
    stateMutability: "payable",
    type: "function"
  },
  // Fee and Tier Functions
  {
    inputs: [{ name: "totalSupply", type: "uint256" }],
    name: "getRequiredFee",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "totalSupply", type: "uint256" }],
    name: "getSupplyTier",
    outputs: [
      { name: "tier", type: "string" },
      { name: "maxSupply", type: "uint256" },
      { name: "feeMultiplier", type: "uint256" }
    ],
    stateMutability: "pure",
    type: "function"
  },
  // Liquidity Management
  {
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "tokenAmount", type: "uint256" }
    ],
    name: "addAndLockLiquidity",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  // Anti-Rug Pull
  {
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "reason", type: "string" }
    ],
    name: "triggerAntiRugPull",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  // View Functions
  {
    inputs: [{ name: "creator", type: "address" }],
    name: "creatorTokens",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "allDeployedTokens",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "tokenAddress", type: "address" }],
    name: "tokenInfo",
    outputs: [
      { name: "tokenAddress", type: "address" },
      { name: "creator", type: "address" },
      { name: "deploymentTime", type: "uint256" },
      { name: "liquidityLockPeriodDays", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "name", type: "string" },
      { indexed: true, name: "symbol", type: "string" },
      { indexed: true, name: "tokenAddress", type: "address" },
      { indexed: false, name: "totalSupply", type: "uint256" },
      { indexed: false, name: "creator", type: "address" },
      { indexed: false, name: "liquidityLockPeriodDays", type: "uint256" }
    ],
    name: "TokenDeployed",
    type: "event"
  }
] as const;

export const PUMPFUN_TOKEN_ABI = [
  // Standard ERC20
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  // Token Locking
  {
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "duration", type: "uint256" }
    ],
    name: "lockTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "unlockTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "holder", type: "address" }],
    name: "lockedTokens",
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "unlockTime", type: "uint256" },
      { name: "isLocked", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  // Transfer Limits
  {
    inputs: [],
    name: "maxTransferAmount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "maxHolding",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "setMaxTransferAmount",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "setMaxHolding",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  // Stability Mechanisms
  {
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "currentPrice", type: "uint256" }
    ],
    name: "stabilityMint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "currentPrice", type: "uint256" }
    ],
    name: "stabilityBurn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  // View Functions
  {
    inputs: [{ name: "holder", type: "address" }],
    name: "getAvailableBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "holder", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "unlockTime", type: "uint256" }
    ],
    name: "TokensLocked",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "holder", type: "address" },
      { indexed: false, name: "amount", type: "uint256" }
    ],
    name: "TokensUnlocked",
    type: "event"
  }
] as const;

export const PUMPFUN_GOVERNANCE_ABI = [
  // Proposal Creation
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "description", type: "string" },
      { name: "proposalType", type: "uint256" },
      { name: "proposedValue", type: "uint256" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" }
    ],
    name: "createProposal",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  // Voting
  {
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "bool" }
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  // Execution
  {
    inputs: [{ name: "proposalId", type: "uint256" }],
    name: "executeProposal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  // View Functions
  {
    inputs: [{ name: "proposalId", type: "uint256" }],
    name: "getProposal",
    outputs: [
      { name: "creator", type: "address" },
      { name: "token", type: "address" },
      { name: "description", type: "string" },
      { name: "votesFor", type: "uint256" },
      { name: "votesAgainst", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "executed", type: "bool" },
      { name: "active", type: "bool" },
      { name: "proposalType", type: "uint256" },
      { name: "proposedValue", type: "uint256" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "proposalCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "proposalId", type: "uint256" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "token", type: "address" },
      { indexed: false, name: "description", type: "string" }
    ],
    name: "ProposalCreated",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "proposalId", type: "uint256" },
      { indexed: true, name: "voter", type: "address" },
      { indexed: false, name: "support", type: "bool" },
      { indexed: false, name: "votingPower", type: "uint256" }
    ],
    name: "VoteCast",
    type: "event"
  }
] as const;

export const PUMPFUN_DEX_MANAGER_ABI = [
  // Liquidity Pool Creation
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tokenAmount", type: "uint256" }
    ],
    name: "createLiquidityPoolWithETH",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  // Trading
  {
    inputs: [
      { name: "tokenOut", type: "address" },
      { name: "amountOutMinimum", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ],
    name: "swapExactETHForTokens",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMinimum", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ],
    name: "swapExactTokensForETH",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  // View Functions
  {
    inputs: [{ name: "token", type: "address" }],
    name: "tokenPrices",
    outputs: [
      { name: "price", type: "uint256" },
      { name: "lastUpdated", type: "uint256" },
      { name: "volume24h", type: "uint256" },
      { name: "marketCap", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "authorizedTokens",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
] as const;
