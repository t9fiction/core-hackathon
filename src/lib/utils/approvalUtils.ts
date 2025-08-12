import { parseUnits, Address } from 'viem';
import { WriteContractErrorType } from '@wagmi/core';
import { CHAINCRAFT_TOKEN_ABI } from '../contracts/abis';

export interface ApprovalParams {
  tokenAddress: Address;
  spenderAddress: Address;
  amount: string;
  decimals?: number;
}

export interface ApprovalResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export interface ApprovalStatus {
  needsApproval: boolean;
  currentAllowance?: bigint;
  requiredAmount?: bigint;
}

/**
 * Check if token approval is needed for a specific amount
 */
export const checkApprovalStatus = (
  currentAllowance: bigint | undefined,
  requiredAmount: string,
  decimals: number = 18
): ApprovalStatus => {
  // If no amount is specified or amount is 0, no approval needed
  if (!requiredAmount || requiredAmount === '0' || parseFloat(requiredAmount) <= 0) {
    return { needsApproval: false, currentAllowance };
  }

  // If allowance is not loaded yet, assume approval needed
  if (currentAllowance === undefined) {
    return { needsApproval: true };
  }

  try {
    const requiredAmountWei = parseUnits(requiredAmount, decimals);
    const needsApproval = currentAllowance < requiredAmountWei;
    
    return {
      needsApproval,
      currentAllowance,
      requiredAmount: requiredAmountWei,
    };
  } catch (error) {
    return { needsApproval: true };
  }
};

/**
 * Format approval amounts for display
 */
export const formatApprovalAmount = (
  amount: bigint,
  decimals: number = 18,
  displayDecimals: number = 4
): string => {
  try {
    const formatted = Number(amount) / (10 ** decimals);
    return formatted.toLocaleString(undefined, { 
      minimumFractionDigits: 0,
      maximumFractionDigits: displayDecimals 
    });
  } catch (error) {
    return "0";
  }
};

/**
 * Get approval transaction parameters
 */
export const getApprovalTxParams = (params: ApprovalParams) => {
  const { tokenAddress, spenderAddress, amount, decimals = 18 } = params;
  
  try {
    const amountWei = parseUnits(amount, decimals);
    
    return {
      address: tokenAddress,
      abi: CHAINCRAFT_TOKEN_ABI,
      functionName: 'approve' as const,
      args: [spenderAddress, amountWei] as const,
    };
  } catch (error) {
    throw new Error(`Failed to prepare approval transaction: ${error}`);
  }
};

/**
 * Common approval error messages
 */
export const getApprovalErrorMessage = (error: WriteContractErrorType | Error | unknown): string => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('user rejected')) {
    return 'Transaction was rejected by user';
  }
  if (errorMessage.includes('insufficient funds')) {
    return 'Insufficient funds for transaction fees';
  }
  if (errorMessage.includes('gas')) {
    return 'Transaction failed due to gas issues';
  }
  if (errorMessage.includes('nonce')) {
    return 'Transaction nonce error - please try again';
  }
  if (errorMessage.includes('reverted')) {
    return 'Transaction was reverted by the contract';
  }
  
  return `Approval failed: ${errorMessage}`;
};

/**
 * Common spender addresses for different protocols
 */
export const COMMON_SPENDERS = {
  SUSHISWAP_V2_ROUTER: '0x9b3336186a38e1b6c21955d112dbb0343ee061ee', // Core DAO
  UNISWAP_V2_ROUTER: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Ethereum (example)
} as const;

/**
 * Get spender name for display purposes
 */
export const getSpenderName = (spenderAddress: string): string => {
  const address = spenderAddress.toLowerCase();
  
  if (address === COMMON_SPENDERS.SUSHISWAP_V2_ROUTER.toLowerCase()) {
    return 'SushiSwap V2 Router';
  }
  if (address === COMMON_SPENDERS.UNISWAP_V2_ROUTER.toLowerCase()) {
    return 'Uniswap V2 Router';
  }
  
  return `Contract ${spenderAddress.slice(0, 8)}...${spenderAddress.slice(-6)}`;
};

/**
 * Standard approval amounts
 */
export const APPROVAL_AMOUNTS = {
  MAX_UINT256: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
  SAFE_MAX: '1000000000000000000000000000000', // 1 trillion tokens with 18 decimals - safe amount
  ZERO: '0',
} as const;

/**
 * Hook-like utility to manage approval state
 */
export class ApprovalManager {
  private approvals: Map<string, ApprovalStatus> = new Map();
  
  getKey(tokenAddress: string, spenderAddress: string): string {
    return `${tokenAddress.toLowerCase()}-${spenderAddress.toLowerCase()}`;
  }
  
  setApprovalStatus(
    tokenAddress: string, 
    spenderAddress: string, 
    status: ApprovalStatus
  ): void {
    const key = this.getKey(tokenAddress, spenderAddress);
    this.approvals.set(key, status);
  }
  
  getApprovalStatus(tokenAddress: string, spenderAddress: string): ApprovalStatus | undefined {
    const key = this.getKey(tokenAddress, spenderAddress);
    return this.approvals.get(key);
  }
  
  clearApprovals(): void {
    this.approvals.clear();
  }
}

export default {
  checkApprovalStatus,
  formatApprovalAmount,
  getApprovalTxParams,
  getApprovalErrorMessage,
  getSpenderName,
  COMMON_SPENDERS,
  APPROVAL_AMOUNTS,
  ApprovalManager,
};
