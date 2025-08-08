import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { Address } from 'viem';
import { getContractAddresses } from '../contracts/addresses';
import { useSmartContractRead } from './useSmartContract';
import { showSuccessAlert, showErrorAlert } from '../swal-config';
import { PUMPFUN_AIRDROP_ABI } from '../contracts/abis';

export interface AirdropInfo {
  merkleRoot: string;
  totalAmount: bigint;
  claimedAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  active: boolean;
  remainingAmount: bigint;
}

export function useAirdrop() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending } = useWriteContract();
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Claim airdrop function
  const claimAirdrop = async (
    tokenAddress: Address,
    amount: bigint,
    merkleProof: string[]
  ) => {
    if (!isConnected || !address) {
      showErrorAlert('Wallet Not Connected', 'Please connect your wallet to claim airdrop');
      return;
    }

    try {
      await writeContract({
        address: contractAddresses.PUMPFUN_AIRDROP,
        abi: PUMPFUN_AIRDROP_ABI,
        functionName: 'claimAirdrop',
        args: [tokenAddress, amount, merkleProof as `0x${string}`[]],
      });

      showSuccessAlert(
        'Airdrop Claimed!',
        'Your tokens have been successfully claimed.'
      );

      return hash;
    } catch (error: any) {
      console.error('Error claiming airdrop:', error);
      showErrorAlert(
        'Claim Failed',
        error.shortMessage || error.message || 'Failed to claim airdrop'
      );
      throw error;
    }
  };

  return {
    claimAirdrop,
    isPending,
    isConfirming,
    isConfirmed,
    transactionHash: hash,
  };
}

// Hook to get airdrop information for a specific token
export function useAirdropInfo(tokenAddress: Address | undefined) {
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  const { data: airdropData } = useSmartContractRead({
    address: contractAddresses.PUMPFUN_AIRDROP,
    abi: PUMPFUN_AIRDROP_ABI,
    functionName: 'getAirdropInfo',
    args: tokenAddress ? [tokenAddress] : undefined,
    enabled: !!tokenAddress,
  });

  const airdropInfo = airdropData && Array.isArray(airdropData) && airdropData.length >= 7 ? {
    merkleRoot: airdropData[0] as string,
    totalAmount: airdropData[1] as bigint,
    claimedAmount: airdropData[2] as bigint,
    startTime: airdropData[3] as bigint,
    endTime: airdropData[4] as bigint,
    active: airdropData[5] as boolean,
    remainingAmount: airdropData[6] as bigint,
  } : undefined;

  return { airdropInfo };
}

// Hook to check if user can claim airdrop
export function useCanClaim(tokenAddress: Address | undefined) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  const { data: canClaim } = useSmartContractRead({
    address: contractAddresses.PUMPFUN_AIRDROP,
    abi: PUMPFUN_AIRDROP_ABI,
    functionName: 'canClaim',
    args: tokenAddress && address ? [tokenAddress, address] : undefined,
    enabled: !!tokenAddress && !!address,
  });

  return { canClaim: canClaim as boolean | undefined };
}

// Hook to check if user has already claimed
export function useHasClaimed(tokenAddress: Address | undefined) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  const { data: hasClaimed } = useSmartContractRead({
    address: contractAddresses.PUMPFUN_AIRDROP,
    abi: PUMPFUN_AIRDROP_ABI,
    functionName: 'hasClaimed',
    args: tokenAddress && address ? [tokenAddress, address] : undefined,
    enabled: !!tokenAddress && !!address,
  });

  return { hasClaimed: hasClaimed as boolean | undefined };
}

// Hook to get contract statistics
export function useAirdropStats() {
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  const { data: statsData } = useSmartContractRead({
    address: contractAddresses.PUMPFUN_AIRDROP,
    abi: PUMPFUN_AIRDROP_ABI,
    functionName: 'getContractStats',
  });

  const stats = statsData && Array.isArray(statsData) && statsData.length >= 2 ? {
    totalAirdropsConfigured: statsData[0] as bigint,
    totalTokensDistributed: statsData[1] as bigint,
  } : undefined;

  return { stats };
}
