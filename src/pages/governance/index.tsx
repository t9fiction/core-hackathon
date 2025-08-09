import React, { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useGovernance } from '../../lib/hooks/useGovernance';
import CreateProposalForm from '../../components/Governance/CreateProposalForm';
import ProposalList from '../../components/Governance/ProposalList';
import GovernanceStats from '../../components/Governance/GovernanceStats';
import { showErrorAlert } from '../../lib/swal-config';

const Governance = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProposalCreated = () => {
    // Force refresh of proposal list
    setRefreshKey(prev => prev + 1);
  };

  const handleProposalUpdated = () => {
    // Force refresh of proposal list
    setRefreshKey(prev => prev + 1);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400">Please connect your wallet to access governance features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            🏛️ Governance Center
          </h1>
          <p className="text-gray-300 text-lg">
            Create and vote on proposals for your tokens
          </p>
          <div className="mt-4 p-4 bg-green-900/30 border border-green-500/50 rounded-lg">
            <p className="text-green-300 text-sm">
              ✅ Governance features are now live! Create and vote on proposals for your tokens.
            </p>
          </div>
        </div>

        {/* Governance Stats */}
        <GovernanceStats />

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Create Proposal */}
          <CreateProposalForm onProposalCreated={handleProposalCreated} />

          {/* All Proposals */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold mb-4 flex items-center text-white">
              <span className="text-blue-400 mr-2">📋</span>
              All Proposals
            </h3>
            
            <div className="h-[700px] overflow-y-auto">
              <ProposalList 
                key={refreshKey} // Force re-render when proposals are updated
                onProposalUpdated={handleProposalUpdated}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Governance;
