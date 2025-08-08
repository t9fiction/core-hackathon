import { useReadContract, useChainId, useAccount, usePublicClient } from 'wagmi';
import { Address } from 'viem';
import { createFallbackPublicClient } from '../fallback-wallet';
import { useQuery } from '@tanstack/react-query';

// Helper function to convert BigInt values to strings for serialization
function serializeBigInt(obj: any): any {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  if (obj && typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }
  return obj;
}

interface UseSmartContractReadProps {
  address: Address;
  abi: any;
  functionName: string;
  args?: any[];
  enabled?: boolean;
}

export function useSmartContractRead({
  address,
  abi,
  functionName,
  args,
  enabled = true,
}: UseSmartContractReadProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  // Use wagmi's useReadContract if wallet is connected
  const connectedResult = useReadContract({
    address,
    abi,
    functionName,
    args,
    query: {
      enabled: enabled && isConnected,
    },
  });

  // Use fallback public client if no wallet is connected
  const fallbackResult = useQuery({
    queryKey: ['fallback-read', address, functionName, serializeBigInt(args), chainId],
    queryFn: async () => {
      try {
        const fallbackClient = createFallbackPublicClient(chainId);
        const result = await fallbackClient.readContract({
          address,
          abi,
          functionName,
          args: args || [],
        });
        // Serialize BigInt values in the result to prevent JSON serialization errors
        return serializeBigInt(result);
      } catch (error) {
        console.warn('Fallback wallet not available:', error);
        throw error;
      }
    },
    enabled: enabled && !isConnected,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 30, // 30 seconds
  });

  // Return the appropriate result based on connection status
  if (isConnected) {
    return connectedResult;
  } else {
    return {
      data: fallbackResult.data,
      isLoading: fallbackResult.isLoading,
      error: fallbackResult.error,
      isError: fallbackResult.isError,
      isSuccess: fallbackResult.isSuccess,
      refetch: fallbackResult.refetch,
    };
  }
}

// Hook to get the current client (user or fallback)
export function useCurrentClient() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  if (isConnected && publicClient) {
    return publicClient;
  }

  return createFallbackPublicClient(chainId);
}

// Hook to check if using fallback wallet
export function useIsFallbackMode() {
  const { isConnected } = useAccount();
  return !isConnected;
}
