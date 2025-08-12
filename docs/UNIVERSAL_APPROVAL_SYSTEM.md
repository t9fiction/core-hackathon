# Universal Approval System

This document describes the universal token approval system that provides seamless, automated approval handling across the entire application.

## Overview

The Universal Approval System consists of utilities and React hooks that automatically handle token approvals without exposing explicit approval UI to users. This creates a much smoother user experience by handling approvals internally within main action flows.

## Architecture

### Core Components

1. **`approvalUtils.ts`** - Low-level utilities for approval operations
2. **`useTokenApproval.ts`** - Individual token approval hook
3. **`useSmartApproval.ts`** - Multi-token orchestration hook
4. **Example implementations** - Showing integration patterns

### Key Features

- ✅ **Automatic approval detection** - Checks current allowances vs required amounts
- ✅ **Seamless UX** - No explicit approval buttons, handled internally
- ✅ **Multi-token support** - Handle multiple token approvals simultaneously
- ✅ **Error handling** - Comprehensive error messages and recovery
- ✅ **Progress tracking** - Visual feedback for ongoing operations
- ✅ **Maximum approvals** - Option to approve max amount for better UX
- ✅ **Universal integration** - Can be used across any component

## Usage Examples

### Basic Single Token Approval

```typescript
import { useTokenApproval, COMMON_SPENDERS } from '@/lib/hooks';

const MyComponent = () => {
  const { address } = useAccount();
  
  const {
    needsApproval,
    approve,
    approvalPending,
    approvalSuccess,
    approvalError,
  } = useTokenApproval({
    tokenAddress: '0x...',
    spenderAddress: COMMON_SPENDERS.SUSHISWAP_V2_ROUTER,
    userAddress: address,
    amount: '1000',
    decimals: 18,
    enableMaxApproval: true, // Better UX
  });

  const handleTransaction = async () => {
    // Check if approval needed
    if (needsApproval) {
      await approve(); // Internally handles approval
      return; // Wait for approval success
    }
    
    // Continue with main transaction
    await executeMainTransaction();
  };

  return (
    <button 
      onClick={handleTransaction}
      disabled={approvalPending}
    >
      {approvalPending ? 'Approving...' : 'Execute Transaction'}
    </button>
  );
};
```

### Multi-Token Smart Approval

```typescript
import { useSmartApproval, TokenApprovalConfig, COMMON_SPENDERS } from '@/lib/hooks';

const LiquidityComponent = () => {
  const { address } = useAccount();
  
  // Configure tokens that need approval
  const tokenConfigs: TokenApprovalConfig[] = [
    {
      tokenAddress: tokenA.address,
      spenderAddress: COMMON_SPENDERS.SUSHISWAP_V2_ROUTER,
      amount: amountA,
      decimals: 18,
      enableMaxApproval: true,
    },
    {
      tokenAddress: tokenB.address,
      spenderAddress: COMMON_SPENDERS.SUSHISWAP_V2_ROUTER,
      amount: amountB,
      decimals: 18,
      enableMaxApproval: true,
    },
  ];

  const {
    isProcessing,
    allApprovalsComplete,
    executeApprovals,
    tokenStates,
    statusMessage,
  } = useSmartApproval({
    userAddress: address,
    tokenConfigs,
    onAllApprovalsComplete: () => {
      console.log('Ready for main transaction');
    },
  });

  const handleAddLiquidity = async () => {
    // First ensure all approvals are complete
    if (!allApprovalsComplete) {
      await executeApprovals();
      return; // Wait for completion
    }
    
    // Now proceed with liquidity addition
    await addLiquidityTransaction();
  };

  return (
    <div>
      {/* Show approval progress */}
      {tokenStates.size > 0 && (
        <div className="mb-4">
          <p>Token Approvals: {statusMessage}</p>
          {Array.from(tokenStates.values()).map(state => (
            <div key={state.tokenAddress}>
              {state.step} - {state.spenderName}
            </div>
          ))}
        </div>
      )}
      
      <button 
        onClick={handleAddLiquidity}
        disabled={isProcessing}
      >
        {isProcessing ? 'Processing...' : 'Add Liquidity'}
      </button>
    </div>
  );
};
```

## API Reference

### `useTokenApproval(options)`

Hook for handling single token approval.

#### Options
```typescript
interface UseTokenApprovalOptions {
  tokenAddress: Address;
  spenderAddress: Address;
  userAddress?: Address;
  amount?: string;
  decimals?: number;
  enableMaxApproval?: boolean; // Use max uint256 approval
}
```

#### Returns
```typescript
interface UseTokenApprovalReturn {
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
  approvalPending: boolean;
  approvalSuccess: boolean;
}
```

### `useSmartApproval(options)`

Hook for orchestrating multiple token approvals.

#### Options
```typescript
interface SmartApprovalOptions {
  userAddress?: Address;
  tokenConfigs: TokenApprovalConfig[];
  onAllApprovalsComplete?: () => void;
  onApprovalComplete?: (tokenAddress: Address) => void;
  onApprovalError?: (tokenAddress: Address, error: string) => void;
}
```

#### Returns
```typescript
interface UseSmartApprovalReturn {
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
  statusMessage: string;
}
```

## Utility Functions

### `approvalUtils`

Low-level utilities for approval operations:

- `checkApprovalStatus(currentAllowance, requiredAmount, decimals)` - Check if approval needed
- `getApprovalTxParams(params)` - Get transaction parameters for approval
- `getApprovalErrorMessage(error)` - Format error messages
- `formatApprovalAmount(amount, decimals)` - Format amounts for display
- `getSpenderName(spenderAddress)` - Get human-readable spender name

### Constants

```typescript
// Common spender addresses
export const COMMON_SPENDERS = {
  SUSHISWAP_V2_ROUTER: '0x9b3336186a38e1b6c21955d112dbb0343ee061ee',
  // Add more as needed
};

// Standard approval amounts
export const APPROVAL_AMOUNTS = {
  MAX_UINT256: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
  ZERO: '0',
};
```

## Best Practices

### 1. Use Maximum Approvals

Enable `enableMaxApproval: true` to approve the maximum uint256 amount instead of exact amounts. This provides better UX by reducing the number of approval transactions needed.

### 2. Handle Approval State Properly

```typescript
// Good: Wait for approval completion before proceeding
const handleAction = async () => {
  if (needsApproval) {
    await approve();
    return; // Exit and wait for approval success
  }
  
  // Continue with main action
  await executeMainAction();
};

// Bad: Don't try to do everything in one function
const handleAction = async () => {
  if (needsApproval) {
    await approve();
    await executeMainAction(); // This will fail
  }
};
```

### 3. Provide User Feedback

Always show the current status and progress:

```typescript
const statusMessage = isProcessing ? currentStep : approvalStatusMessage;

return (
  <div>
    {statusMessage && <p>{statusMessage}</p>}
    <button disabled={isProcessing}>
      {isProcessing ? 'Processing...' : 'Execute'}
    </button>
  </div>
);
```

### 4. Error Handling

```typescript
const {
  approvalError,
  hasErrors,
} = useSmartApproval({
  // ... options
  onApprovalError: (tokenAddress, error) => {
    console.error(`Approval failed for ${tokenAddress}:`, error);
    // Show user-friendly error message
    setError(`Token approval failed: ${error}`);
  },
});
```

## Migration Guide

### From Manual Approval Components

**Before:**
```typescript
// Separate approval step
const [step, setStep] = useState('approve');

if (step === 'approve') {
  return <ApprovalButton onSuccess={() => setStep('execute')} />;
}

return <ExecuteButton />;
```

**After:**
```typescript
// Integrated approval
const { needsApproval, approve, approvalPending } = useTokenApproval({...});

const handleExecute = async () => {
  if (needsApproval) {
    await approve();
    return;
  }
  await executeTransaction();
};

return (
  <button onClick={handleExecute} disabled={approvalPending}>
    {approvalPending ? 'Processing...' : 'Execute'}
  </button>
);
```

## Integration Examples

See the following components for complete implementation examples:

- `src/components/DEX/UniversalPoolManager.tsx` - Pool creation with approvals
- `src/components/examples/SmartLiquidityExample.tsx` - Liquidity addition example

## Error States and Recovery

The system handles various error scenarios:

- **User Rejection**: Clear message, allow retry
- **Insufficient Gas**: Gas estimation errors
- **Contract Reverts**: Contract-specific error messages
- **Network Issues**: Connection and timeout errors

All errors are formatted into user-friendly messages and provide appropriate recovery actions.

## Testing

When testing components using the approval system:

1. Mock the `useTokenApproval` and `useSmartApproval` hooks
2. Test various approval states (needed, processing, success, error)
3. Verify proper error handling and user feedback
4. Test transaction chaining (approval → main transaction)

## Performance Considerations

- The system batches multiple token approvals efficiently
- Uses React's concurrent features for smooth UX
- Minimizes re-renders with proper dependency management
- Caches approval states to reduce redundant checks

This universal system provides a consistent, user-friendly approach to token approvals across the entire application.
