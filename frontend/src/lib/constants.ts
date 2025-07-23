// Contract addresses on Sepolia
export const CONTRACTS = {
  // PumpFunToken template - individual tokens are deployed by factory
  PUMPFUN_TOKEN: '0xa22b23f1349f1429912916cD707139d9F379D5Ec',
  // Factory deployed on Sepolia
  PUMPFUN_FACTORY: '0x1867E3073d7a7889e485feadeb1d1df0236E460E',
} as const;

// Supply tiers for token creation
export const SUPPLY_TIERS = {
  STANDARD: {
    name: 'Standard',
    maxSupply: 100000000,
    feeMultiplier: 1,
    description: 'Up to 100M tokens - 1x base fee',
  },
  PREMIUM: {
    name: 'Premium', 
    maxSupply: 500000000,
    feeMultiplier: 3,
    description: 'Up to 500M tokens - 3x base fee',
  },
  ULTIMATE: {
    name: 'Ultimate',
    maxSupply: 1000000000,
    feeMultiplier: 10,
    description: 'Up to 1B tokens - 10x base fee',
  },
} as const;

// Base deployment fee (0.05 ETH)
export const BASE_FEE = '0.05';

// Time constants
export const TIME_CONSTANTS = {
  MIN_LOCK_DURATION: 1 * 24 * 60 * 60, // 1 day in seconds
  MAX_LOCK_DURATION: 365 * 24 * 60 * 60, // 365 days in seconds
  MIN_LIQUIDITY_LOCK_PERIOD_DAYS: 30,
  TRANSFER_COOLDOWN: 60 * 60, // 1 hour in seconds
  VOTING_PERIOD: 7 * 24 * 60 * 60, // 7 days in seconds
} as const;

// PumpFunToken ABI (key functions only)
export const PUMPFUN_TOKEN_ABI = [
  // View functions
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function getAvailableBalance(address holder) view returns (uint256)',
  'function getLockedTokens(address holder) view returns (uint256 amount, uint256 unlockTime, bool isLocked)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function maxTransferAmount() view returns (uint256)',
  'function maxHolding() view returns (uint256)',
  'function transferLimitsEnabled() view returns (bool)',
  'function governanceEnabled() view returns (bool)',
  'function proposalCount() view returns (uint256)',
  'function getProposal(uint256 proposalId) view returns (address creator, string description, uint256 votesFor, uint256 votesAgainst, uint256 endTime, bool executed, bool active)',
  'function hasVoted(uint256 proposalId, address voter) view returns (bool)',
  
  // Token functions
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function burn(uint256 value)',
  'function burnFrom(address account, uint256 value)',
  
  // Locking functions
  'function lockTokens(uint256 amount, uint256 duration)',
  'function unlockTokens()',
  
  // Governance functions
  'function createProposal(string description) returns (uint256)',
  'function vote(uint256 proposalId, bool support)',
  'function executeProposal(uint256 proposalId)',
  
  // Admin functions (only owner)
  'function setMaxTransferAmount(uint256 newAmount)',
  'function setMaxHolding(uint256 newAmount)',
  'function setTransferLimitsEnabled(bool enabled)',
  'function setGovernanceEnabled(bool enabled)',
  'function emergencyPause()',
  'function emergencyUnpause()',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event TokensLocked(address indexed holder, uint256 amount, uint256 unlockTime)',
  'event TokensUnlocked(address indexed holder, uint256 amount)',
  'event ProposalCreated(uint256 indexed proposalId, address indexed creator, string description)',
  'event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)',
  'event ProposalExecuted(uint256 indexed proposalId)',
] as const;

// PumpFunFactory ABI (for when it's deployed)
export const PUMPFUN_FACTORY_ABI = [
  // View functions
  'function etherFee() view returns (uint256)',
  'function totalTokensDeployed() view returns (uint256)',
  'function totalFeesCollected() view returns (uint256)',
  'function getAllDeployedTokens() view returns (address[])',
  'function getTokensByCreator(address creator) view returns (address[])',
  'function getTokenInfo(address tokenAddress) view returns (address creator, uint256 deploymentTime, uint256 liquidityLockPeriodDays)',
  'function getRequiredFee(uint256 totalSupply) view returns (uint256)',
  'function getSupplyTier(uint256 totalSupply) view returns (string tier, uint256 maxSupply, uint256 feeMultiplier)',
  'function isDeployedToken(address tokenAddress) view returns (bool)',
  
  // Main functions
  'function deployToken(string name, string symbol, uint256 totalSupply, uint256 liquidityLockPeriodDays) payable',
  'function addAndLockLiquidity(address tokenAddress, uint256 tokenAmount) payable',
  
  // Events
  'event TokenDeployed(string indexed name, string indexed symbol, address indexed tokenAddress, uint256 totalSupply, address creator, uint256 liquidityLockPeriodDays)',
  'event LiquidityAdded(address indexed token, address indexed creator, uint256 ethAmount, uint256 tokenAmount)',
] as const;
