import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatEther, parseEther } from 'viem';
import { SUPPLY_TIERS, BASE_FEE } from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format token amounts with appropriate decimals
export function formatTokenAmount(amount: bigint, decimals: number = 18, maxDecimals: number = 4): string {
  const factor = BigInt(10 ** decimals);
  const whole = amount / factor;
  const remainder = amount % factor;
  
  if (remainder === 0n) {
    return whole.toString();
  }
  
  const decimal = remainder.toString().padStart(decimals, '0');
  const trimmed = decimal.slice(0, maxDecimals).replace(/0+$/, '');
  
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

// Format large numbers with appropriate suffixes
export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

// Get supply tier information
export function getSupplyTier(totalSupply: number) {
  if (totalSupply <= SUPPLY_TIERS.STANDARD.maxSupply) {
    return SUPPLY_TIERS.STANDARD;
  } else if (totalSupply <= SUPPLY_TIERS.PREMIUM.maxSupply) {
    return SUPPLY_TIERS.PREMIUM;
  } else {
    return SUPPLY_TIERS.ULTIMATE;
  }
}

// Calculate deployment fee based on supply
export function calculateDeploymentFee(totalSupply: number): string {
  const tier = getSupplyTier(totalSupply);
  const baseFee = parseFloat(BASE_FEE);
  return (baseFee * tier.feeMultiplier).toString();
}

// Format time duration
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const mins = Math.floor((seconds % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${mins}m`;
  } else {
    return `${mins}m`;
  }
}

// Format time remaining
export function formatTimeRemaining(endTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = endTimestamp - now;
  
  if (remaining <= 0) {
    return 'Expired';
  }
  
  return formatDuration(remaining);
}

// Truncate address for display
export function truncateAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Calculate voting power percentage
export function calculateVotingPower(userBalance: bigint, totalSupply: bigint): number {
  if (totalSupply === 0n) return 0;
  return Number((userBalance * 10000n) / totalSupply) / 100;
}

// Format ETH amounts
export function formatEthAmount(amount: bigint): string {
  return formatEther(amount);
}

// Parse ETH amounts
export function parseEthAmount(amount: string): bigint {
  return parseEther(amount);
}

// Check if address is valid
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Calculate quorum percentage
export function calculateQuorum(totalSupply: bigint, quorumPercentage: number = 10): bigint {
  return (totalSupply * BigInt(quorumPercentage)) / 100n;
}

// Check if proposal meets quorum
export function meetsQuorum(votesFor: bigint, votesAgainst: bigint, totalSupply: bigint): boolean {
  const totalVotes = votesFor + votesAgainst;
  const requiredQuorum = calculateQuorum(totalSupply);
  return totalVotes >= requiredQuorum;
}

// Format proposal status
export function getProposalStatus(
  active: boolean,
  executed: boolean,
  endTime: number,
  votesFor: bigint,
  votesAgainst: bigint,
  totalSupply: bigint
): 'Active' | 'Passed' | 'Failed' | 'Executed' | 'Expired' {
  if (executed) return 'Executed';
  
  const now = Math.floor(Date.now() / 1000);
  const hasEnded = now >= endTime;
  
  if (!hasEnded && active) return 'Active';
  
  if (hasEnded) {
    const meetQuorum = meetsQuorum(votesFor, votesAgainst, totalSupply);
    if (!meetQuorum) return 'Failed';
    
    if (votesFor > votesAgainst) return 'Passed';
    return 'Failed';
  }
  
  return 'Expired';
}
