import React, { useState } from 'react';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useSmartApproval, TokenApprovalConfig } from '@/lib/hooks/useSmartApproval';
import { COMMON_SPENDERS } from '@/lib/utils/approvalUtils';

interface SmartLiquidityExampleProps {
  tokenA: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  tokenB: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  amountA: string;
  amountB: string;
  onLiquidityAdded?: (hash: string) => void;
}

export const SmartLiquidityExample: React.FC<SmartLiquidityExampleProps> = ({
  tokenA,
  tokenB,
  amountA,
  amountB,
  onLiquidityAdded,
}) => {
  const { address: userAddress } = useAccount();
  const [addingLiquidity, setAddingLiquidity] = useState(false);
  const [liquidityError, setLiquidityError] = useState<string>();
  const [liquiditySuccess, setLiquiditySuccess] = useState(false);

  // Configure token approvals
  const tokenConfigs: TokenApprovalConfig[] = [
    {
      tokenAddress: tokenA.address,
      spenderAddress: COMMON_SPENDERS.SUSHISWAP_V2_ROUTER,
      amount: amountA,
      decimals: tokenA.decimals,
      enableMaxApproval: true, // Use max approval for better UX
    },
    {
      tokenAddress: tokenB.address,
      spenderAddress: COMMON_SPENDERS.SUSHISWAP_V2_ROUTER,
      amount: amountB,
      decimals: tokenB.decimals,
      enableMaxApproval: true,
    },
  ];

  // Smart approval hook
  const {
    isProcessing,
    allApprovalsComplete,
    hasErrors,
    tokenStates,
    executeApprovals,
    completedCount,
    totalCount,
    progressPercentage,
    statusMessage,
  } = useSmartApproval({
    userAddress,
    tokenConfigs,
    onAllApprovalsComplete: () => {
      console.log('All approvals completed, ready to add liquidity');
    },
    onApprovalError: (tokenAddress, error) => {
      console.error(`Approval failed for ${tokenAddress}:`, error);
    },
  });

  // Add liquidity function (mock implementation)
  const addLiquidity = async () => {
    setAddingLiquidity(true);
    setLiquidityError(undefined);

    try {
      // Mock liquidity addition - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockHash = '0x1234...5678';
      setLiquiditySuccess(true);
      onLiquidityAdded?.(mockHash);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add liquidity';
      setLiquidityError(errorMessage);
    } finally {
      setAddingLiquidity(false);
    }
  };

  // Main action handler
  const handleAddLiquidity = async () => {
    if (!allApprovalsComplete) {
      await executeApprovals();
    } else {
      await addLiquidity();
    }
  };

  const getStepIcon = (step: string, isProcessing: boolean) => {
    if (isProcessing) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    
    switch (step) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const isProcessingOverall = isProcessing || addingLiquidity;
  const showApprovals = tokenStates.size > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Smart Liquidity Addition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Token Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">{tokenA.symbol}:</span> {amountA}
            </div>
            <div>
              <span className="font-medium">{tokenB.symbol}:</span> {amountB}
            </div>
          </div>

          {/* Approval Progress */}
          {showApprovals && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Token Approvals</span>
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{totalCount}
                </span>
              </div>
              
              <Progress value={progressPercentage} className="w-full" />
              
              <div className="space-y-2">
                {Array.from(tokenStates.values()).map(state => (
                  <div key={state.tokenAddress} className="flex items-center gap-3 text-sm">
                    {getStepIcon(state.step, state.isProcessing)}
                    <span className="flex-1">
                      {state.spenderName}
                    </span>
                    <span className="capitalize text-xs text-muted-foreground">
                      {state.step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Message */}
          <div className="text-sm text-center p-2 bg-muted rounded">
            {liquiditySuccess ? 'Liquidity added successfully!' : statusMessage}
          </div>

          {/* Error Alerts */}
          {hasErrors && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Some approvals failed. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {liquidityError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {liquidityError}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Button */}
          <Button
            onClick={handleAddLiquidity}
            disabled={isProcessingOverall || !userAddress || liquiditySuccess}
            className="w-full"
          >
            {isProcessingOverall ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {addingLiquidity ? 'Adding Liquidity...' : 'Processing Approvals...'}
              </>
            ) : liquiditySuccess ? (
              'Liquidity Added Successfully!'
            ) : allApprovalsComplete ? (
              'Add Liquidity'
            ) : (
              'Approve Tokens & Add Liquidity'
            )}
          </Button>

          {/* Info */}
          <div className="text-xs text-muted-foreground text-center">
            This example automatically handles token approvals before adding liquidity.
            Approvals use maximum allowance for optimal user experience.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartLiquidityExample;
