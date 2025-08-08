import React from 'react';
import { useGovernance } from '../../lib/hooks/useGovernance';
import { useSmartContractRead } from '../../lib/hooks/useSmartContract';
import { PUMPFUN_FACTORY_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';
import { useChainId } from 'wagmi';

const GovernanceStats: React.FC = () => {
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);
  const { proposalCount } = useGovernance();

  // Get total tokens deployed (for context)
  const { data: totalTokensDeployed } = useSmartContractRead({
    address: contractAddresses.PUMPFUN_FACTORY,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: 'totalTokensDeployed',
  });

  const stats = [
    {
      label: 'Total Proposals',
      value: proposalCount ? Number(proposalCount) : 0,
      icon: '📋',
      color: 'text-blue-400'
    },
    {
      label: 'Tokens Created',
      value: totalTokensDeployed ? Number(totalTokensDeployed) : 0,
      icon: '🪙',
      color: 'text-green-400'
    },
    {
      label: 'Governance Status',
      value: 'Active',
      icon: '⚡',
      color: 'text-purple-400'
    },
    {
      label: 'Participation',
      value: 'Community Driven',
      icon: '🤝',
      color: 'text-orange-400'
    }
  ];

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center">
        <span className="text-purple-400 mr-2">📊</span>
        Governance Overview
      </h2>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">{stat.icon}</span>
              <span className="text-xs text-slate-400 font-medium">{stat.label}</span>
            </div>
            <div className={`text-lg font-bold ${stat.color}`}>
              {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-600">
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="text-purple-400 font-medium">Governance Features:</span> Token holders can create proposals, vote on community decisions, and help shape the future of their tokens. All proposals require community participation to succeed.
        </p>
      </div>
    </div>
  );
};

export default GovernanceStats;
