import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { Address, formatEther } from 'viem';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI, PUMPFUN_GOVERNANCE_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';
import { useTokenGovernance } from '../../lib/hooks/useTokenContracts';
import Swal from 'sweetalert2';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
}

interface Proposal {
  id: number;
  creator: string;
  token: string;
  description: string;
  votesFor: bigint;
  votesAgainst: bigint;
  endTime: bigint;
  executed: boolean;
  active: boolean;
  proposalType: bigint;
  proposedValue: bigint;
  recipients: string[];
  amounts: bigint[];
}

const Governance = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  // State management
  const [selectedToken, setSelectedToken] = useState<Address | ''>('');
  const [userTokens, setUserTokens] = useState<TokenInfo[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  
  // Proposal creation states
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalType, setProposalType] = useState(1);
  const [proposedValue, setProposedValue] = useState('');

  // Governance hook
  const governance = useTokenGovernance(selectedToken as Address);

  // Fetch user's deployed tokens
  const { data: tokenAddresses } = useReadContract({
    address: contractAddresses?.PUMPFUN_FACTORY as `0x${string}`,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: 'getTokensByCreator',
    args: [address!],
    query: {
      enabled: isConnected && !!address && !!contractAddresses?.PUMPFUN_FACTORY,
    },
  });

  // Fetch proposal count for selected token
  const { data: proposalCount } = useReadContract({
    address: contractAddresses?.PUMPFUN_GOVERNANCE as `0x${string}`,
    abi: PUMPFUN_GOVERNANCE_ABI,
    functionName: 'proposalCount',
    query: {
      enabled: !!contractAddresses?.PUMPFUN_GOVERNANCE,
    },
  });

  // TokenDataFetcher component for each token
  const TokenDataFetcher = ({ tokenAddress, onDataFetched }: { tokenAddress: string, onDataFetched: (data: TokenInfo) => void }) => {
    const { data: name } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: "name",
    });
    const { data: symbol } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: "symbol",
    });
    const { data: totalSupply } = useReadContract({
      address: tokenAddress as Address,
      abi: PUMPFUN_TOKEN_ABI,
      functionName: "totalSupply",
    });

    useEffect(() => {
      if (name && symbol && totalSupply !== undefined) {
        onDataFetched({
          address: tokenAddress,
          name: name as string,
          symbol: symbol as string,
          totalSupply: formatEther(totalSupply),
        })
      }
    }, [name, symbol, totalSupply, onDataFetched, tokenAddress]);

    return null;
  };

  // Individual Proposal Fetcher
  const ProposalDataFetcher = ({ proposalId, onDataFetched }: { proposalId: number, onDataFetched: (data: Proposal) => void }) => {
    const { data: proposalData } = useReadContract({
      address: contractAddresses?.PUMPFUN_GOVERNANCE as `0x${string}`,
      abi: PUMPFUN_GOVERNANCE_ABI,
      functionName: 'getProposal',
      args: [BigInt(proposalId)],
      query: {
        enabled: !!contractAddresses?.PUMPFUN_GOVERNANCE && proposalId >= 0,
      },
    });

    useEffect(() => {
      if (proposalData) {
        const [creator, token, description, votesFor, votesAgainst, endTime, executed, active, proposalType, proposedValue, recipients, amounts] = proposalData as [string, string, string, bigint, bigint, bigint, boolean, boolean, bigint, bigint, string[], bigint[]];
        
        onDataFetched({
          id: proposalId,
          creator,
          token,
          description,
          votesFor,
          votesAgainst,
          endTime,
          executed,
          active,
          proposalType,
          proposedValue,
          recipients,
          amounts,
        });
      }
    }, [proposalData, proposalId, onDataFetched]);

    return null;
  };

  // Handle token data fetching
  useEffect(() => {
    if (tokenAddresses && tokenAddresses.length > 0) {
      setIsLoadingTokens(true);
      setUserTokens([]);
    } else {
      setUserTokens([]);
      setIsLoadingTokens(false);
    }
  }, [tokenAddresses, chainId]);

  const handleTokenDataFetched = useCallback((data: TokenInfo) => {
    setUserTokens(prevTokens => {
      const existingIndex = prevTokens.findIndex((token) => token.address === data.address);
      
      if (existingIndex >= 0) {
        const existingToken = prevTokens[existingIndex];
        const hasChanged = JSON.stringify(existingToken) !== JSON.stringify(data);
        
        if (hasChanged) {
          return prevTokens.map((token) => 
            token.address === data.address ? data : token
          );
        }
        return prevTokens;
      } else {
        return [...prevTokens, data];
      }
    });
  }, []);

  // Helper function to compare proposals with BigInt support
  const compareProposals = (a: Proposal, b: Proposal): boolean => {
    return (
      a.id === b.id &&
      a.creator === b.creator &&
      a.token === b.token &&
      a.description === b.description &&
      a.votesFor === b.votesFor &&
      a.votesAgainst === b.votesAgainst &&
      a.endTime === b.endTime &&
      a.executed === b.executed &&
      a.active === b.active &&
      a.proposalType === b.proposalType &&
      a.proposedValue === b.proposedValue &&
      JSON.stringify(a.recipients) === JSON.stringify(b.recipients) &&
      a.amounts.length === b.amounts.length &&
      a.amounts.every((amount, index) => amount === b.amounts[index])
    );
  };

  // Handle proposal data fetching
  const handleProposalDataFetched = useCallback((data: Proposal) => {
    setProposals(prevProposals => {
      const existingIndex = prevProposals.findIndex((p) => p.id === data.id);
      
      if (existingIndex >= 0) {
        const existingProposal = prevProposals[existingIndex];
        const hasChanged = !compareProposals(existingProposal, data);
        
        if (hasChanged) {
          return prevProposals.map((proposal) => 
            proposal.id === data.id ? data : proposal
          );
        }
        return prevProposals;
      } else {
        return [...prevProposals, data];
      }
    });
  }, []);

  // Stop loading when all tokens are fetched
  useEffect(() => {
    if (tokenAddresses && userTokens.length === tokenAddresses.length && userTokens.length > 0) {
      setIsLoadingTokens(false);
    }
  }, [tokenAddresses, userTokens.length]);

  // Load proposals when proposal count changes
  useEffect(() => {
    if (proposalCount && Number(proposalCount) > 0) {
      setIsLoadingProposals(true);
      setProposals([]);
    } else {
      setProposals([]);
      setIsLoadingProposals(false);
    }
  }, [proposalCount]);

  // Stop loading proposals when all are fetched
  useEffect(() => {
    if (proposalCount && proposals.length === Number(proposalCount) && proposals.length > 0) {
      setIsLoadingProposals(false);
    }
  }, [proposalCount, proposals.length]);

  // Handle proposal creation
  const handleCreateProposal = async () => {
    if (!selectedToken || !proposalDescription.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Information',
        text: 'Please select a token and enter a description',
      });
      return;
    }

    try {
      // Show loading alert
      Swal.fire({
        title: 'Creating Proposal',
        text: 'Please confirm the transaction in your wallet...',
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Create proposal and get transaction hash
      await governance.createProposal(
        proposalDescription,
        proposalType,
        proposedValue || '0'
      );

      // Update loading message
      Swal.update({
        title: 'Transaction Submitted',
        text: 'Waiting for transaction confirmation...',
        icon: 'info',
      });

    } catch (error) {
      console.error('Error creating proposal:', error);
      Swal.fire({
        icon: 'error',
        title: 'Transaction Failed',
        text: 'Failed to create proposal: ' + (error as Error).message,
      });
    }
  };

  // Watch for transaction confirmation
  useEffect(() => {
    if (governance.isConfirmed && governance.isCreatingProposal) {
      // Reset form
      setProposalDescription('');
      setProposedValue('');

      // Show success message and refresh
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Proposal created successfully!',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        window.location.reload();
      });
    }
  }, [governance.isConfirmed, governance.isCreatingProposal]);

  // Handle voting
  const handleVote = async (proposalId: number, support: boolean) => {
    try {
      // Show loading alert
      Swal.fire({
        title: 'Submitting Vote',
        text: 'Please confirm the transaction in your wallet...',
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      await governance.vote(proposalId, support);
      
      Swal.fire({
        icon: 'success',
        title: 'Vote Submitted!',
        text: `Your vote ${support ? 'for' : 'against'} proposal #${proposalId} has been submitted!`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Error voting:', error);
      Swal.fire({
        icon: 'error',
        title: 'Vote Failed',
        text: 'Failed to vote: ' + (error as Error).message,
      });
    }
  };

  // Filter proposals for selected token
  const filteredProposals = proposals.filter(proposal => 
    !selectedToken || proposal.token.toLowerCase() === selectedToken.toLowerCase()
  );

  const formatTimeRemaining = (endTime: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(endTime) - now;
    
    if (remaining <= 0) return 'Ended';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const calculateVotePercentage = (votesFor: bigint, votesAgainst: bigint, isFor: boolean) => {
    const total = Number(votesFor) + Number(votesAgainst);
    if (total === 0) return 0;
    const votes = isFor ? Number(votesFor) : Number(votesAgainst);
    return (votes / total) * 100;
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
      {/* Hidden TokenDataFetcher components */}
      {tokenAddresses && tokenAddresses.map((tokenAddress) => (
        <TokenDataFetcher
          key={tokenAddress}
          tokenAddress={tokenAddress as string}
          onDataFetched={handleTokenDataFetched}
        />
      ))}
      
      {/* Hidden ProposalDataFetcher components */}
      {proposalCount && Array.from({ length: Number(proposalCount) }, (_, i) => (
        <ProposalDataFetcher
          key={i}
          proposalId={i}
          onDataFetched={handleProposalDataFetched}
        />
      ))}

      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            🏛️ Governance Center
          </h1>
          <p className="text-gray-300 text-lg">
            Create and vote on proposals for your tokens
          </p>
        </div>

        {/* Token Selection */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
          <h3 className="text-xl font-bold mb-4 flex items-center text-white">
            <span className="text-yellow-400 mr-2">🎯</span>
            Select Token for Governance
          </h3>
          
          {isLoadingTokens ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
              <span className="ml-3 text-gray-300">Loading your tokens...</span>
            </div>
          ) : userTokens.length > 0 ? (
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as Address)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
            >
              <option value="">-- Select a Token --</option>
              {userTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.name} ({token.symbol})
                </option>
              ))}
            </select>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🪙</div>
              <h4 className="text-lg font-semibold text-white mb-2">No Tokens Found</h4>
              <p className="text-gray-400 mb-4">
                You haven't deployed any tokens yet. Deploy a token first to create governance proposals.
              </p>
            </div>
          )}
          
          {selectedToken && (
            <div className="mt-4 p-3 bg-purple-900/30 border border-purple-500/50 rounded">
              <p className="text-purple-300 text-sm">
                <span className="font-semibold">Selected:</span> {userTokens.find(t => t.address === selectedToken)?.name}
              </p>
              <p className="text-purple-300 text-xs mt-1">
                <span className="font-semibold">Voting Power:</span> {governance.votingPower} tokens
              </p>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Create Proposal */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 flex items-center text-white">
              <span className="text-green-400 mr-2">✏️</span>
              Create Proposal
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Proposal Type</label>
                <select
                  value={proposalType}
                  onChange={(e) => setProposalType(Number(e.target.value))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
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
                disabled={!selectedToken || !proposalDescription.trim() || governance.isCreatingProposal}
                className="w-full bg-purple-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                {governance.isCreatingProposal ? 'Creating...' : 'Create Proposal'}
              </button>
            </div>
          </div>

          {/* Active Proposals */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 flex items-center text-white">
              <span className="text-blue-400 mr-2">📋</span>
              {selectedToken ? 'Token Proposals' : 'All Proposals'}
            </h3>
            
            {isLoadingProposals ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <span className="ml-3 text-gray-300">Loading proposals...</span>
              </div>
            ) : filteredProposals.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredProposals.map((proposal) => {
                  const forPercentage = calculateVotePercentage(proposal.votesFor, proposal.votesAgainst, true);
                  const againstPercentage = calculateVotePercentage(proposal.votesFor, proposal.votesAgainst, false);
                  
                  return (
                    <div key={proposal.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <div className="mb-3">
                        <p className="text-white font-medium mb-1">{proposal.description}</p>
                        <div className="flex justify-between items-center text-xs text-gray-400">
                          <span>Proposal #{proposal.id}</span>
                          <span className={proposal.active ? 'text-green-400' : 'text-red-400'}>
                            {proposal.executed ? 'Executed' : proposal.active ? formatTimeRemaining(proposal.endTime) : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Vote Bars */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>For: {formatEther(proposal.votesFor)} votes ({forPercentage.toFixed(1)}%)</span>
                          <span>Against: {formatEther(proposal.votesAgainst)} votes ({againstPercentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-l-full transition-all duration-300" 
                            style={{ width: `${forPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Vote Buttons */}
                      {proposal.active && !proposal.executed && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleVote(proposal.id, true)}
                            disabled={governance.isVoting}
                            className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                          >
                            Vote For
                          </button>
                          <button 
                            onClick={() => handleVote(proposal.id, false)}
                            disabled={governance.isVoting}
                            className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                          >
                            Vote Against
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📜</div>
                <h4 className="text-lg font-semibold text-white mb-2">No Proposals Found</h4>
                <p className="text-gray-400">
                  {selectedToken 
                    ? 'No proposals exist for this token yet.' 
                    : 'No proposals have been created yet.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Governance;
