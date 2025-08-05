import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { showErrorAlert, showSuccessAlert } from '../../lib/swal-config';

const Governance = () => {
  const { address, isConnected } = useAccount();
  
  // Dummy state for future implementation
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalType, setProposalType] = useState(1);
  const [proposedValue, setProposedValue] = useState('');

  // Dummy proposals data
  const dummyProposals = [
    {
      id: 1,
      description: "Increase maximum transfer amount to 2% of total supply",
      status: "Active",
      votesFor: 150,
      votesAgainst: 25,
      timeRemaining: "2d 14h remaining"
    },
    {
      id: 2,
      description: "Enable token burning mechanism",
      status: "Executed",
      votesFor: 200,
      votesAgainst: 50,
      timeRemaining: "Executed"
    }
  ];

  // Dummy handlers for future implementation
  const handleCreateProposal = async () => {
    if (!proposalDescription.trim()) {
      showErrorAlert('Missing Information', 'Please enter a proposal description');
      return;
    }
    
    // Show success for demo purposes
    showSuccessAlert('Coming Soon!', 'Governance functionality will be available in a future update');
    
    // Reset form
    setProposalDescription('');
    setProposedValue('');
  };

  const handleVote = async (proposalId: number, support: boolean) => {
    showSuccessAlert('Coming Soon!', 'Voting functionality will be available in a future update');
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
          <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
            <p className="text-yellow-300 text-sm">
              ⚠️ Governance features are coming soon! This is a preview of the upcoming functionality.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Create Proposal */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 flex items-center text-white">
              <span className="text-green-400 mr-2">✏️</span>
              Create Proposal (Coming Soon)
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Proposal Type</label>
                <select
                  value={proposalType}
                  onChange={(e) => setProposalType(Number(e.target.value))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                  disabled
                >
                  <option value={1}>Update Max Transfer</option>
                  <option value={2}>Update Max Holding</option>
                  <option value={3}>Toggle Transfer Limits</option>
                  <option value={4}>Execute Airdrop</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-2">Description</label>
                <textarea
                  value={proposalDescription}
                  onChange={(e) => setProposalDescription(e.target.value)}
                  placeholder="Describe your proposal in detail..."
                  rows={4}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
                />
              </div>
              
              {proposalType !== 4 && (
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Proposed Value</label>
                  <input
                    type="number"
                    value={proposedValue}
                    onChange={(e) => setProposedValue(e.target.value)}
                    placeholder="Enter value (if applicable)"
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                  />
                </div>
              )}
              
              <button
                onClick={handleCreateProposal}
                className="w-full bg-purple-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-600 transition-all duration-300"
              >
                Create Proposal (Preview)
              </button>
            </div>
          </div>

          {/* Active Proposals */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 flex items-center text-white">
              <span className="text-blue-400 mr-2">📋</span>
              Sample Proposals
            </h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {dummyProposals.map((proposal) => {
                const totalVotes = proposal.votesFor + proposal.votesAgainst;
                const forPercentage = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
                
                return (
                  <div key={proposal.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="mb-3">
                      <p className="text-white font-medium mb-1">{proposal.description}</p>
                      <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>Proposal #{proposal.id}</span>
                        <span className={proposal.status === 'Active' ? 'text-green-400' : 'text-blue-400'}>
                          {proposal.timeRemaining}
                        </span>
                      </div>
                    </div>
                    
                    {/* Vote Bars */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>For: {proposal.votesFor} votes ({forPercentage.toFixed(1)}%)</span>
                        <span>Against: {proposal.votesAgainst} votes ({(100 - forPercentage).toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-l-full transition-all duration-300" 
                          style={{ width: `${forPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Vote Buttons */}
                    {proposal.status === 'Active' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleVote(proposal.id, true)}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                          Vote For (Preview)
                        </button>
                        <button 
                          onClick={() => handleVote(proposal.id, false)}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                          Vote Against (Preview)
                        </button>
                      </div>
                    )}
                    
                    {proposal.status === 'Executed' && (
                      <div className="bg-blue-900/30 border border-blue-500/50 rounded p-2 text-center">
                        <span className="text-blue-300 text-sm">✅ Proposal Executed</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Governance;
