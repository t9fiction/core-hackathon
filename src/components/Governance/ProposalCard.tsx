import React, { useState } from 'react';
import { Address, formatEther } from 'viem';
import { useAccount } from 'wagmi';
import { 
  useProposal, 
  useHasVoted, 
  useGovernance, 
  getProposalTypeConfig, 
  getProposalStatus, 
  getTimeRemaining,
  Proposal
} from '../../lib/hooks/useGovernance';
import { useSmartContractRead } from '../../lib/hooks/useSmartContract';
import { CHAINCRAFT_TOKEN_ABI } from '../../lib/contracts/abis/token';

interface ProposalCardProps {
  proposal: Proposal;
  onProposalUpdated?: () => void;
}

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, onProposalUpdated }) => {
  const { address, isConnected } = useAccount();
  const { hasVoted } = useHasVoted(proposal.id);
  const { vote, isPending } = useGovernance();
  const [isVoting, setIsVoting] = useState(false);
  
  // Get token information
  const { data: tokenName } = useSmartContractRead({
    address: proposal?.token,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'name',
    enabled: !!proposal?.token,
  });

  const { data: tokenSymbol } = useSmartContractRead({
    address: proposal?.token,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'symbol',
    enabled: !!proposal?.token,
  });

  if (!proposal) {
    return (
      <div className="bg-slate-700 rounded-lg p-4 border border-slate-600 animate-pulse">
        <div className="h-4 bg-slate-600 rounded mb-2"></div>
        <div className="h-3 bg-slate-600 rounded mb-4"></div>
        <div className="h-2 bg-slate-600 rounded"></div>
      </div>
    );
  }

  const proposalTypeConfig = getProposalTypeConfig(proposal.proposalType);
  const status = getProposalStatus(proposal);
  const timeRemaining = getTimeRemaining(proposal.endTime);
  
  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const forPercentage = totalVotes > 0 ? Number(proposal.votesFor) / Number(totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? Number(proposal.votesAgainst) / Number(totalVotes) * 100 : 0;

  const handleVote = async (support: boolean) => {
    setIsVoting(true);
    try {
      await vote(proposal.id, support);
      // Success is handled by the hook via showSuccessAlert
      onProposalUpdated?.();
    } catch (error) {
      // Error is handled by the hook via showErrorAlert
    } finally {
      setIsVoting(false);
    }
  };

  const formatAddress = (addr: Address) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'executed': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'passed': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'expired': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🔴';
      case 'executed': return '✅';
      case 'passed': return '🎯';
      case 'expired': return '⏰';
      default: return '❓';
    }
  };

  return (
    <div className="bg-slate-700 rounded-lg p-6 border border-slate-600 hover:border-slate-500 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xs font-medium text-slate-400">#{proposal.id}</span>
            <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(status)}`}>
              {getStatusIcon(status)} {status.toUpperCase()}
            </span>
            {proposalTypeConfig && (
              <span className="text-xs px-2 py-1 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                {proposalTypeConfig.name}
              </span>
            )}
          </div>
          
          <h4 className="text-white font-medium text-sm mb-1 line-clamp-2">
            {proposal.description}
          </h4>
          
          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <span>By {formatAddress(proposal.creator)}</span>
            {tokenName && tokenSymbol ? (
              <span>Token: {tokenSymbol as string} ({formatAddress(proposal.token)})</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Proposal Details */}
      {proposalTypeConfig?.requiresValue && proposal.proposedValue > 0 && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-600">
          <p className="text-xs text-slate-400 mb-1">Proposed Value</p>
          <p className="text-white font-medium">{formatEther(proposal.proposedValue)} tokens</p>
        </div>
      )}

      {proposalTypeConfig?.requiresRecipients && proposal.recipients.length > 0 && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-600">
          <p className="text-xs text-slate-400 mb-2">Recipients ({proposal.recipients.length})</p>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {proposal.recipients.slice(0, 3).map((recipient, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="text-white font-mono">{formatAddress(recipient)}</span>
                <span className="text-slate-400">
                  {proposal.amounts[index] ? formatEther(proposal.amounts[index]) : '0'} tokens
                </span>
              </div>
            ))}
            {proposal.recipients.length > 3 && (
              <p className="text-xs text-slate-400">... and {proposal.recipients.length - 3} more</p>
            )}
          </div>
        </div>
      )}

      {/* Voting Stats */}
      <div className="mb-4">
        <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
          <span>For: {Number(proposal.votesFor)} votes ({forPercentage.toFixed(1)}%)</span>
          <span>Against: {Number(proposal.votesAgainst)} votes ({againstPercentage.toFixed(1)}%)</span>
        </div>
        
        <div className="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
          <div className="h-full flex">
            <div 
              className="bg-green-500 transition-all duration-300" 
              style={{ width: `${forPercentage}%` }}
            />
            <div 
              className="bg-red-500 transition-all duration-300" 
              style={{ width: `${againstPercentage}%` }}
            />
          </div>
        </div>
        
        <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
          <span>Total votes: {Number(totalVotes)}</span>
          <span>{timeRemaining}</span>
        </div>
      </div>

      {/* Voting Actions */}
      {isConnected && status === 'active' && (
        <div className="space-y-2">
          {hasVoted ? (
            <div className="text-center p-2 bg-blue-400/10 border border-blue-400/20 rounded-lg">
              <span className="text-blue-300 text-sm">✓ You have already voted on this proposal</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleVote(true)}
                disabled={isVoting || isPending}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-1"
              >
                {isVoting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>👍</span>
                    <span>Vote For</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleVote(false)}
                disabled={isVoting || isPending}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-1"
              >
                {isVoting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>👎</span>
                    <span>Vote Against</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {!isConnected && status === 'active' && (
        <div className="text-center p-2 bg-amber-400/10 border border-amber-400/20 rounded-lg">
          <span className="text-amber-300 text-sm">Connect wallet to vote on this proposal</span>
        </div>
      )}

      {status === 'executed' && (
        <div className="text-center p-2 bg-blue-400/10 border border-blue-400/20 rounded-lg">
          <span className="text-blue-300 text-sm">✅ Proposal executed successfully</span>
        </div>
      )}

      {status === 'passed' && (
        <div className="text-center p-2 bg-purple-400/10 border border-purple-400/20 rounded-lg">
          <span className="text-purple-300 text-sm">🎯 Proposal passed - ready for execution</span>
        </div>
      )}

      {status === 'expired' && (
        <div className="text-center p-2 bg-red-400/10 border border-red-400/20 rounded-lg">
          <span className="text-red-300 text-sm">⏰ Proposal expired without passing</span>
        </div>
      )}
    </div>
  );
};

export default ProposalCard;
