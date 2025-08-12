import { useState, useCallback, useEffect } from 'react';
import { Address } from 'viem';
import { useTokenApproval } from './useTokenApproval';

export interface TokenApprovalConfig {
  tokenAddress: Address;
  spenderAddress: Address;
  amount: string;
  decimals?: number;
  enableMaxApproval?: boolean;
}

export interface SmartApprovalOptions {
  userAddress?: Address;
  tokenConfigs: TokenApprovalConfig[];
  onAllApprovalsComplete?: () => void;
  onApprovalComplete?: (tokenAddress: Address) => void;
  onApprovalError?: (tokenAddress: Address, error: string) => void;
}

export type ApprovalStep = 'idle' | 'checking' | 'approving' | 'waiting' | 'completed' | 'error';

export interface TokenApprovalState {
  tokenAddress: Address;
  step: ApprovalStep;
  needsApproval: boolean;
  isProcessing: boolean;
  error?: string;
  hash?: string;
  spenderName: string;
}

export interface UseSmartApprovalReturn {
  // Overall state
  isProcessing: boolean;
  allApprovalsComplete: boolean;
  hasErrors: boolean;
  
  // Token states
  tokenStates: Map<Address, TokenApprovalState>;
  
  // Functions
  executeApprovals: () => Promise<void>;
  reset: () => void;
  
  // Progress
  completedCount: number;
  totalCount: number;
  progressPercentage: number;
  
  // Current status message
  statusMessage: string;
}

export const useSmartApproval = (options: SmartApprovalOptions): UseSmartApprovalReturn => {
  const { userAddress, tokenConfigs, onAllApprovalsComplete, onApprovalComplete, onApprovalError } = options;

  const [tokenStates, setTokenStates] = useState<Map<Address, TokenApprovalState>>(new Map());
  const [isExecuting, setIsExecuting] = useState(false);

  // Initialize token approval hooks for each token
  const approvalHooks = tokenConfigs.map(config => {
    return useTokenApproval({
      tokenAddress: config.tokenAddress,
      spenderAddress: config.spenderAddress,
      userAddress,
      amount: config.amount,
      decimals: config.decimals,
      enableMaxApproval: config.enableMaxApproval,
    });
  });

  // Update token states based on hook states
  useEffect(() => {
    const newStates = new Map<Address, TokenApprovalState>();
    
    tokenConfigs.forEach((config, index) => {
      const hook = approvalHooks[index];
      const prevState = tokenStates.get(config.tokenAddress);
      
      let step: ApprovalStep = 'idle';
      let isProcessing = false;
      let error = hook.approvalError;
      
      if (hook.approvalSuccess) {
        step = 'completed';
      } else if (hook.isWaitingForConfirmation) {
        step = 'waiting';
        isProcessing = true;
      } else if (hook.isApproving) {
        step = 'approving';
        isProcessing = true;
      } else if (error) {
        step = 'error';
      } else if (!hook.needsApproval) {
        step = 'completed';
      } else if (prevState?.step === 'checking') {
        step = 'checking';
      }
      
      newStates.set(config.tokenAddress, {
        tokenAddress: config.tokenAddress,
        step,
        needsApproval: hook.needsApproval,
        isProcessing,
        error,
        hash: hook.approvalHash,
        spenderName: hook.spenderName,
      });
    });
    
    setTokenStates(newStates);
  }, [approvalHooks, tokenConfigs]);

  // Handle approval completion callbacks
  useEffect(() => {
    tokenStates.forEach((state, tokenAddress) => {
      if (state.step === 'completed' && onApprovalComplete) {
        onApprovalComplete(tokenAddress);
      }
      if (state.step === 'error' && state.error && onApprovalError) {
        onApprovalError(tokenAddress, state.error);
      }
    });
  }, [tokenStates, onApprovalComplete, onApprovalError]);

  // Check if all approvals are complete
  const allApprovalsComplete = Array.from(tokenStates.values()).every(
    state => state.step === 'completed'
  );

  // Handle all approvals complete callback
  useEffect(() => {
    if (allApprovalsComplete && tokenStates.size === tokenConfigs.length && onAllApprovalsComplete) {
      onAllApprovalsComplete();
    }
  }, [allApprovalsComplete, tokenStates.size, tokenConfigs.length, onAllApprovalsComplete]);

  // Progress calculation
  const completedCount = Array.from(tokenStates.values()).filter(
    state => state.step === 'completed'
  ).length;
  const totalCount = tokenConfigs.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Overall processing state
  const isProcessing = isExecuting || Array.from(tokenStates.values()).some(state => state.isProcessing);

  // Errors
  const hasErrors = Array.from(tokenStates.values()).some(state => state.step === 'error');

  // Status message
  const statusMessage = (() => {
    if (hasErrors) {
      const errorCount = Array.from(tokenStates.values()).filter(state => state.step === 'error').length;
      return `${errorCount} approval${errorCount > 1 ? 's' : ''} failed`;
    }
    
    if (allApprovalsComplete) {
      return 'All approvals completed successfully';
    }
    
    if (isProcessing) {
      const processingState = Array.from(tokenStates.values()).find(state => state.isProcessing);
      if (processingState?.step === 'approving') {
        return 'Waiting for approval transaction signature...';
      }
      if (processingState?.step === 'waiting') {
        return 'Waiting for transaction confirmation...';
      }
      return 'Processing approvals...';
    }
    
    const pendingCount = Array.from(tokenStates.values()).filter(
      state => state.needsApproval && state.step !== 'completed'
    ).length;
    
    if (pendingCount > 0) {
      return `${pendingCount} token${pendingCount > 1 ? 's' : ''} require${pendingCount === 1 ? 's' : ''} approval`;
    }
    
    return 'Ready';
  })();

  // Execute approvals function
  const executeApprovals = useCallback(async () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    
    try {
      // Update states to show checking
      setTokenStates(prev => {
        const newStates = new Map(prev);
        tokenConfigs.forEach(config => {
          const currentState = newStates.get(config.tokenAddress);
          if (currentState && currentState.needsApproval && currentState.step === 'idle') {
            newStates.set(config.tokenAddress, {
              ...currentState,
              step: 'checking'
            });
          }
        });
        return newStates;
      });

      // Execute approvals for tokens that need them
      const approvalPromises = tokenConfigs.map(async (config, index) => {
        const hook = approvalHooks[index];
        
        if (hook.needsApproval) {
          try {
            await hook.approve();
          } catch (error) {
            console.error(`Approval failed for token ${config.tokenAddress}:`, error);
            // Error state is handled by the hook's error state
          }
        }
      });

      await Promise.allSettled(approvalPromises);
      
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, tokenConfigs, approvalHooks]);

  // Reset function
  const reset = useCallback(() => {
    setTokenStates(new Map());
    setIsExecuting(false);
    // Note: Individual approval hooks have their own reset methods
    // that would need to be called separately if needed
  }, []);

  return {
    // Overall state
    isProcessing,
    allApprovalsComplete,
    hasErrors,
    
    // Token states
    tokenStates,
    
    // Functions
    executeApprovals,
    reset,
    
    // Progress
    completedCount,
    totalCount,
    progressPercentage,
    
    // Current status message
    statusMessage,
  };
};

export default useSmartApproval;
