import { useState, useCallback, useMemo } from 'react';
import { Address } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { CHAINCRAFT_TOKEN_ABI } from '../contracts/abis';
import {
  checkApprovalStatus,
  getApprovalTxParams,
  getApprovalErrorMessage,
  getSpenderName,
  APPROVAL_AMOUNTS,
  ApprovalParams,
  ApprovalStatus,
} from '../utils/approvalUtils';

export interface UseTokenApprovalOptions {
  tokenAddress: Address;
  spenderAddress: Address;
  userAddress?: Address;
  amount?: string;
  decimals?: number;
  enableMaxApproval?: boolean; // If true, approves max uint256 instead of exact amount
}

export interface UseTokenApprovalReturn {
  // Status
  needsApproval: boolean;
  isApproving: boolean;
  isWaitingForConfirmation: boolean;
  approvalStatus: ApprovalStatus;
  
  // Data
  currentAllowance?: bigint;
  spenderName: string;
  
  // Functions
  approve: () => Promise<void>;
  checkApproval: () => void;
  
  // Results
  approvalHash?: string;
  approvalError?: string;
  
  // Success states
  approvalPending: boolean;
  approvalSuccess: boolean;
}

export const useTokenApproval = (options: UseTokenApprovalOptions): UseTokenApprovalReturn => {
  const {
    tokenAddress,
    spenderAddress,
    userAddress,
    amount = '0',
    decimals = 18,
    enableMaxApproval = false,
  } = options;

  const [approvalError, setApprovalError] = useState<string>();

  // Read current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, spenderAddress] : undefined,
    query: {
      enabled: !!userAddress && !!tokenAddress && !!spenderAddress,
    },
  });

  // Approval status
  const approvalStatus = useMemo(() => {
    return checkApprovalStatus(currentAllowance, amount, decimals);
  }, [currentAllowance, amount, decimals]);

  // Approval transaction - use safe max to avoid overflow
  const approvalAmount = enableMaxApproval ? APPROVAL_AMOUNTS.SAFE_MAX : amount;
  const approvalParams: ApprovalParams = {
    tokenAddress,
    spenderAddress,
    amount: approvalAmount,
    decimals,
  };

  const {
    writeContract: writeApproval,
    data: approvalHash,
    isPending: isApproving,
    error: writeError,
    reset: resetApproval,
  } = useWriteContract();

  // Wait for approval transaction confirmation
  const {
    isLoading: isWaitingForConfirmation,
    isSuccess: approvalSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: approvalHash,
    query: {
      enabled: !!approvalHash,
    },
  });

  // Combined error handling
  const combinedError = writeError || receiptError;
  const finalError = combinedError ? getApprovalErrorMessage(combinedError) : approvalError;

  // Spender name for UI
  const spenderName = getSpenderName(spenderAddress);

  // Approve function
  const approve = useCallback(async () => {
    try {
      setApprovalError(undefined);
      resetApproval();

      const txParams = getApprovalTxParams(approvalParams);
      writeApproval(txParams);
    } catch (error) {
      const errorMessage = getApprovalErrorMessage(error);
      setApprovalError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [writeApproval, resetApproval, approvalParams]);

  // Check approval function (refetch allowance)
  const checkApproval = useCallback(() => {
    refetchAllowance();
  }, [refetchAllowance]);

  return {
    // Status
    needsApproval: approvalStatus.needsApproval,
    isApproving,
    isWaitingForConfirmation,
    approvalStatus,
    
    // Data
    currentAllowance,
    spenderName,
    
    // Functions
    approve,
    checkApproval,
    
    // Results
    approvalHash,
    approvalError: finalError,
    
    // Success states
    approvalPending: isApproving || isWaitingForConfirmation,
    approvalSuccess,
  };
};

export default useTokenApproval;
