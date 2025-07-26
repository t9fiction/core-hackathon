
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
