import { useState, useEffect, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { Address, parseEther } from 'viem';
import { CHAINCRAFT_GOVERNANCE_ABI } from '../contracts/abis/governance';
import { getContractAddresses } from '../contracts/addresses';
import { useSmartContractRead } from './useSmartContract';
import { showSuccessAlert, showErrorAlert } from '../swal-config';

export interface Proposal {
  id: number;
  creator: Address;
  token: Address;
  description: string;
  votesFor: bigint;
  votesAgainst: bigint;
  endTime: bigint;
  executed: boolean;
  active: boolean;
  proposalType: number;
  proposedValue: bigint;
  recipients: Address[];
  amounts: bigint[];
}

export interface ProposalTypeConfig {
  id: number;
  name: string;
  description: string;
  requiresValue: boolean;
  requiresRecipients: boolean;
}

export const PROPOSAL_TYPES: ProposalTypeConfig[] = [
  {
    id: 1,
    name: "Update Max Transfer",
    description: "Change the maximum transfer amount limit",
    requiresValue: true,
    requiresRecipients: false,
  },
  {
    id: 2,
    name: "Update Max Holding",
    description: "Change the maximum holding amount limit", 
    requiresValue: true,
    requiresRecipients: false,
  },
  {
    id: 3,
    name: "Toggle Transfer Limits",
    description: "Enable or disable transfer limits",
    requiresValue: false,
    requiresRecipients: false,
  },
  // {
  //   id: 4,
  //   name: "Execute Airdrop",
  //   description: "Distribute tokens to specified addresses",
  //   requiresValue: false,
  //   requiresRecipients: true,
  // },
];

export function useGovernance() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending } = useWriteContract();
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Get total proposal count
  const { data: proposalCount } = useSmartContractRead({
    address: contractAddresses.CHAINCRAFT_GOVERNANCE,
    abi: CHAINCRAFT_GOVERNANCE_ABI,
    functionName: 'proposalCount',
  });

  // Create proposal function
  const createProposal = async (
    tokenAddress: Address,
    description: string,
    proposalType: number,
    proposedValue: bigint = 0n,
    recipients: Address[] = [],
    amounts: bigint[] = []
  ) => {
    if (!isConnected || !address) {
      showErrorAlert('Wallet Not Connected', 'Please connect your wallet to create proposals');
      return;
    }

    if (!description.trim()) {
      showErrorAlert('Invalid Input', 'Please provide a proposal description');
      return;
    }

    try {
      await writeContract({
        address: contractAddresses.CHAINCRAFT_GOVERNANCE,
        abi: CHAINCRAFT_GOVERNANCE_ABI,
        functionName: 'createProposal',
        args: [tokenAddress, description, BigInt(proposalType), proposedValue, recipients, amounts],
      });

      return hash;
    } catch (error: any) {
      console.error('Error creating proposal:', error);
      showErrorAlert(
        'Transaction Failed',
        error.shortMessage || error.message || 'Failed to create proposal'
      );
      throw error;
    }
  };

  // Vote on proposal function
  const vote = async (proposalId: number, support: boolean) => {
    if (!isConnected || !address) {
      showErrorAlert('Wallet Not Connected', 'Please connect your wallet to vote');
      return;
    }

    try {
      await writeContract({
        address: contractAddresses.CHAINCRAFT_GOVERNANCE,
        abi: CHAINCRAFT_GOVERNANCE_ABI,
        functionName: 'vote',
        args: [BigInt(proposalId), support],
      });

      return hash;
    } catch (error: any) {
      console.error('Error voting:', error);
      showErrorAlert(
        'Transaction Failed',
        error.shortMessage || error.message || 'Failed to cast vote'
      );
      throw error;
    }
  };

  // Execute proposal function
  const executeProposal = async (proposalId: number) => {
    if (!isConnected || !address) {
      showErrorAlert('Wallet Not Connected', 'Please connect your wallet to execute proposals');
      return;
    }

    try {
      await writeContract({
        address: contractAddresses.CHAINCRAFT_GOVERNANCE,
        abi: CHAINCRAFT_GOVERNANCE_ABI,
        functionName: 'executeProposal',
        args: [BigInt(proposalId)],
      });

      return hash;
    } catch (error: any) {
      console.error('Error executing proposal:', error);
      showErrorAlert(
        'Transaction Failed',
        error.shortMessage || error.message || 'Failed to execute proposal'
      );
      throw error;
    }
  };

  // Get all proposals function
  const getAllProposals = async (): Promise<Proposal[]> => {
    if (!proposalCount || proposalCount === 0n) {
      return [];
    }

    const proposals: Proposal[] = [];
    const count = Number(proposalCount);
    
    for (let i = 1; i <= count; i++) {
      try {
        // We'll use the smart contract read hook to get individual proposals
        // This is a simplified approach - in production you might want to batch these calls
        const proposalData = await contractAddresses.CHAINCRAFT_GOVERNANCE;
        // For now, we'll return proposal IDs and let components handle individual fetching
        proposals.push({ id: i } as Proposal);
      } catch (error) {
        console.error(`Error fetching proposal ${i}:`, error);
      }
    }
    
    return proposals;
  };

  return {
    proposalCount: proposalCount as bigint | undefined,
    createProposal,
    vote,
    executeProposal,
    getAllProposals,
    isPending,
    isConfirming,
    isConfirmed,
    transactionHash: hash,
  };
}

// Hook to get a specific proposal
export function useProposal(proposalId: number | undefined) {
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  const { data: proposalData } = useSmartContractRead({
    address: contractAddresses.CHAINCRAFT_GOVERNANCE,
    abi: CHAINCRAFT_GOVERNANCE_ABI,
    functionName: 'getProposal',
    args: proposalId !== undefined ? [BigInt(proposalId)] : undefined,
    enabled: proposalId !== undefined,
  });

  const proposal = useMemo(() => {
    if (!proposalData || !Array.isArray(proposalData) || proposalData.length < 12) {
      return undefined;
    }

    return {
      id: proposalId!,
      creator: proposalData[0] as Address,
      token: proposalData[1] as Address,
      description: proposalData[2] as string,
      votesFor: proposalData[3] as bigint,
      votesAgainst: proposalData[4] as bigint,
      endTime: proposalData[5] as bigint,
      executed: proposalData[6] as boolean,
      active: proposalData[7] as boolean,
      proposalType: Number(proposalData[8]),
      proposedValue: proposalData[9] as bigint,
      recipients: proposalData[10] as Address[],
      amounts: proposalData[11] as bigint[],
    } as Proposal;
  }, [proposalData, proposalId]);

  return { proposal };
}

// Hook to get all proposals
export function useAllProposals() {
  const { proposalCount } = useGovernance();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAllProposals = async () => {
      if (!proposalCount || proposalCount === 0n) {
        setProposals([]);
        return;
      }

      setIsLoading(true);
      try {
        const proposalPromises = [];
        for (let i = 1; i <= Number(proposalCount); i++) {
          // We'll create individual proposal hooks for each ID
          proposalPromises.push(i);
        }
        
        // For now, we'll set the proposal IDs and let individual components fetch data
        const proposalIds = proposalPromises;
        
        setIsLoading(false);
        return proposalIds;
      } catch (error) {
        console.error('Error fetching proposals:', error);
        setIsLoading(false);
      }
    };

    fetchAllProposals();
  }, [proposalCount]);

  return {
    proposalCount: Number(proposalCount || 0),
    isLoading,
  };
}

// Hook to check if user has voted on a proposal
export function useHasVoted(proposalId: number | undefined, voterAddress?: Address) {
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  const { address } = useAccount();
  
  const voter = voterAddress || address;

  const { data: hasVoted } = useSmartContractRead({
    address: contractAddresses.CHAINCRAFT_GOVERNANCE,
    abi: CHAINCRAFT_GOVERNANCE_ABI,
    functionName: 'hasVotedOnProposal',
    args: proposalId !== undefined && voter ? [BigInt(proposalId), voter] : undefined,
    enabled: proposalId !== undefined && !!voter,
  });

  return { hasVoted: hasVoted as boolean | undefined };
}

// Utility functions
export function getProposalTypeConfig(typeId: number): ProposalTypeConfig | undefined {
  return PROPOSAL_TYPES.find(type => type.id === typeId);
}

export function getProposalStatus(proposal: Proposal): 'active' | 'executed' | 'expired' | 'passed' {
  const now = Date.now() / 1000;
  const endTime = Number(proposal.endTime);
  
  if (proposal.executed) return 'executed';
  if (now > endTime) {
    const totalVotes = proposal.votesFor + proposal.votesAgainst;
    if (totalVotes > 0 && proposal.votesFor > proposal.votesAgainst) {
      return 'passed';
    }
    return 'expired';
  }
  return 'active';
}

export function getTimeRemaining(endTime: bigint): string {
  const now = Date.now() / 1000;
  const endTimeSeconds = Number(endTime);
  const diff = endTimeSeconds - now;
  
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / (24 * 60 * 60));
  const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((diff % (60 * 60)) / 60);
  
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}
