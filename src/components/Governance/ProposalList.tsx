import React, { useState, useEffect } from 'react';
import { useGovernance, useProposal } from '../../lib/hooks/useGovernance';
import ProposalCard from './ProposalCard';

interface ProposalListProps {
  onProposalUpdated?: () => void;
}

// Individual proposal fetcher component
const ProposalFetcher: React.FC<{ proposalId: number; onProposalUpdated?: () => void }> = ({ 
  proposalId, 
  onProposalUpdated 
}) => {
  const { proposal } = useProposal(proposalId);

  if (!proposal) {
    return (
      <div className="bg-slate-700 rounded-lg p-4 border border-slate-600 animate-pulse">
        <div className="h-4 bg-slate-600 rounded mb-2"></div>
        <div className="h-3 bg-slate-600 rounded mb-4"></div>
        <div className="h-2 bg-slate-600 rounded"></div>
      </div>
    );
  }

  return (
    <ProposalCard 
      proposal={proposal} 
      onProposalUpdated={onProposalUpdated}
    />
  );
};

const ProposalList: React.FC<ProposalListProps> = ({ onProposalUpdated }) => {
  const { proposalCount } = useGovernance();
  const [proposalIds, setProposalIds] = useState<number[]>([]);

  useEffect(() => {
    if (proposalCount && proposalCount > 0n) {
      const count = Number(proposalCount);
      const ids = Array.from({ length: count }, (_, i) => i + 1);
      setProposalIds(ids.reverse()); // Show newest first
    } else {
      setProposalIds([]);
    }
  }, [proposalCount]);

  if (proposalIds.length === 0) {
    return (
      <div className="text-center py-8">
        <span className="text-4xl mb-2 block">🗳️</span>
        <p className="text-slate-400">No proposals yet</p>
        <p className="text-slate-500 text-sm mt-1">Create the first proposal to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {proposalIds.map(proposalId => (
        <ProposalFetcher
          key={proposalId}
          proposalId={proposalId}
          onProposalUpdated={onProposalUpdated}
        />
      ))}
    </div>
  );
};

export default ProposalList;
