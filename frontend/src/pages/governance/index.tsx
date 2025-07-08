import React, { useState } from 'react'
import { useAccount } from 'wagmi';

const Governance = () => {
      // Governance states
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposals, setProposals] = useState([]);
  const { address, isConnected } = useAccount();

  return (
    <div className="mt-12 bg-gray-800 rounded-xl py-12 px-14">
    <h3 className="text-xl font-bold mb-4 flex items-center">
      <span className="text-purple-400 mr-2">🏛️</span>
      Governance
    </h3>
    <div className="grid md:grid-cols-2 gap-6 pb-12">
      <div>
        <h4 className="font-bold mb-4">Create Proposal</h4>
        <div className="space-y-4">
          <textarea
            value={proposalDescription}
            onChange={(e) => setProposalDescription(e.target.value)}
            placeholder="Describe your proposal..."
            rows={4}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            disabled={!isConnected}
            className="w-full bg-purple-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            Create Proposal
          </button>
        </div>
      </div>
      
      <div>
        <h4 className="font-bold mb-4">Active Proposals</h4>
        <div className="space-y-3">
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm mb-2">Reduce transfer cooldown to 30 minutes</p>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Proposal #1</span>
              <div className="flex gap-2">
                <button className="bg-green-500 text-black px-3 py-1 rounded text-xs font-bold">
                  Vote Yes
                </button>
                <button className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold">
                  Vote No
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm mb-2">Increase max transfer amount to 2%</p>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Proposal #2</span>
              <div className="flex gap-2">
                <button className="bg-green-500 text-black px-3 py-1 rounded text-xs font-bold">
                  Vote Yes
                </button>
                <button className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold">
                  Vote No
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
  )
}

export default Governance