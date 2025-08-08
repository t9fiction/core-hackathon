import React, { useState, useEffect } from 'react';
import { Address, parseEther, formatEther } from 'viem';
import { useAccount } from 'wagmi';
import { useGovernance, PROPOSAL_TYPES, ProposalTypeConfig } from '../../lib/hooks/useGovernance';
import { useSmartContractRead } from '../../lib/hooks/useSmartContract';
import { PUMPFUN_FACTORY_ABI, PUMPFUN_TOKEN_ABI } from '../../lib/contracts/abis';
import { getContractAddresses } from '../../lib/contracts/addresses';
import { showErrorAlert, showSuccessAlert } from '../../lib/swal-config';

interface CreateProposalFormProps {
  onProposalCreated?: () => void;
}

interface AirdropRecipient {
  address: string;
  amount: string;
}

const CreateProposalForm: React.FC<CreateProposalFormProps> = ({ onProposalCreated }) => {
  const { address, isConnected, chainId } = useAccount();
  const { createProposal, isPending, isConfirming } = useGovernance();
  const contractAddresses = getContractAddresses(chainId || 1);
  
  // Form state
  const [selectedToken, setSelectedToken] = useState<Address>('0x' as Address);
  const [proposalType, setProposalType] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [proposedValue, setProposedValue] = useState('');
  const [airdropRecipients, setAirdropRecipients] = useState<AirdropRecipient[]>([
    { address: '', amount: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get available tokens
  const { data: allTokens } = useSmartContractRead({
    address: contractAddresses.PUMPFUN_FACTORY,
    abi: PUMPFUN_FACTORY_ABI,
    functionName: 'getAllDeployedTokens',
  });

  // Get token info for selected token
  const { data: tokenName } = useSmartContractRead({
    address: selectedToken,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'name',
    enabled: selectedToken !== '0x',
  });

  const { data: tokenSymbol } = useSmartContractRead({
    address: selectedToken,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'symbol',
    enabled: selectedToken !== '0x',
  });

  const { data: tokenDecimals } = useSmartContractRead({
    address: selectedToken,
    abi: PUMPFUN_TOKEN_ABI,
    functionName: 'decimals',
    enabled: selectedToken !== '0x',
  });

  // Set default token when tokens are loaded
  useEffect(() => {
    if (allTokens && Array.isArray(allTokens) && allTokens.length > 0 && selectedToken === '0x') {
      setSelectedToken(allTokens[0] as Address);
    }
  }, [allTokens, selectedToken]);

  const currentProposalType = PROPOSAL_TYPES.find(type => type.id === proposalType);

  const addAirdropRecipient = () => {
    setAirdropRecipients([...airdropRecipients, { address: '', amount: '' }]);
  };

  const removeAirdropRecipient = (index: number) => {
    setAirdropRecipients(airdropRecipients.filter((_, i) => i !== index));
  };

  const updateAirdropRecipient = (index: number, field: 'address' | 'amount', value: string) => {
    const updated = [...airdropRecipients];
    updated[index][field] = value;
    setAirdropRecipients(updated);
  };

  const validateForm = (): boolean => {
    if (!selectedToken || selectedToken === '0x') {
      showErrorAlert('Invalid Input', 'Please select a token');
      return false;
    }

    if (!description.trim()) {
      showErrorAlert('Invalid Input', 'Please provide a proposal description');
      return false;
    }

    if (currentProposalType?.requiresValue && (!proposedValue || parseFloat(proposedValue) <= 0)) {
      showErrorAlert('Invalid Input', 'Please provide a valid proposed value');
      return false;
    }

    if (currentProposalType?.requiresRecipients) {
      const validRecipients = airdropRecipients.filter(r => r.address.trim() && r.amount.trim());
      if (validRecipients.length === 0) {
        showErrorAlert('Invalid Input', 'Please provide at least one recipient with address and amount');
        return false;
      }

      // Validate addresses
      for (const recipient of validRecipients) {
        if (!recipient.address.match(/^0x[a-fA-F0-9]{40}$/)) {
          showErrorAlert('Invalid Input', `Invalid address: ${recipient.address}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      showErrorAlert('Wallet Not Connected', 'Please connect your wallet to create proposals');
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      let proposedValueBigInt = 0n;
      let recipients: Address[] = [];
      let amounts: bigint[] = [];

      if (currentProposalType?.requiresValue) {
        proposedValueBigInt = parseEther(proposedValue);
      }

      if (currentProposalType?.requiresRecipients) {
        const validRecipients = airdropRecipients.filter(r => r.address.trim() && r.amount.trim());
        recipients = validRecipients.map(r => r.address.trim() as Address);
        amounts = validRecipients.map(r => parseEther(r.amount.trim()));
      }

      await createProposal(
        selectedToken,
        description.trim(),
        proposalType,
        proposedValueBigInt,
        recipients,
        amounts
      );

      // Success - reset form
      setDescription('');
      setProposedValue('');
      setAirdropRecipients([{ address: '', amount: '' }]);
      
      showSuccessAlert(
        'Proposal Created!',
        'Your proposal has been submitted successfully and is now open for voting.'
      );

      onProposalCreated?.();
    } catch (error) {
      console.error('Error creating proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-slate-400">Please connect your wallet to create governance proposals</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-xl font-bold mb-6 flex items-center text-white">
        <span className="text-green-400 mr-2">✏️</span>
        Create New Proposal
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token Selection */}
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">
            Select Token *
          </label>
          <select
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value as Address)}
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
            required
          >
            <option value="0x">Select a token...</option>
            {allTokens && Array.isArray(allTokens) ? (allTokens as string[]).map((tokenAddr, index) => (
              <option key={index} value={tokenAddr}>
                {tokenAddr} {tokenName && tokenSymbol && selectedToken === tokenAddr ? `(${tokenSymbol as string})` : ''}
              </option>
            )) : null}
          </select>
          {selectedToken !== '0x' && tokenName && tokenSymbol ? (
            <p className="mt-1 text-xs text-slate-400">
              Selected: {tokenName as string} ({tokenSymbol as string})
            </p>
          ) : null}
        </div>

        {/* Proposal Type */}
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">
            Proposal Type *
          </label>
          <select
            value={proposalType}
            onChange={(e) => setProposalType(Number(e.target.value))}
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
            required
          >
            {PROPOSAL_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          {currentProposalType && (
            <p className="mt-1 text-xs text-slate-400">
              {currentProposalType.description}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your proposal in detail. Explain what changes you want to make and why..."
            rows={4}
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-slate-400 resize-none"
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            {description.length}/500 characters
          </p>
        </div>

        {/* Proposed Value (for certain proposal types) */}
        {currentProposalType?.requiresValue && (
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Proposed Value *
            </label>
            <div className="relative">
              <input
                type="number"
                value={proposedValue}
                onChange={(e) => setProposedValue(e.target.value)}
                placeholder="Enter value in tokens..."
                step="0.000001"
                min="0"
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-slate-400"
                required
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm">
                {(tokenSymbol as string) || 'tokens'}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Specify the new value for this parameter
            </p>
          </div>
        )}

        {/* Airdrop Recipients (for airdrop proposals) */}
        {currentProposalType?.requiresRecipients && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-slate-300 text-sm font-medium">
                Airdrop Recipients *
              </label>
              <button
                type="button"
                onClick={addAirdropRecipient}
                className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center space-x-1"
              >
                <span>+</span>
                <span>Add Recipient</span>
              </button>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {airdropRecipients.map((recipient, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-700 rounded-lg border border-slate-600">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="0x... (Recipient address)"
                      value={recipient.address}
                      onChange={(e) => updateAirdropRecipient(index, 'address', e.target.value)}
                      className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 text-sm font-mono"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      placeholder="Amount"
                      value={recipient.amount}
                      onChange={(e) => updateAirdropRecipient(index, 'amount', e.target.value)}
                      step="0.000001"
                      min="0"
                      className="flex-1 p-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 text-sm"
                    />
                    {airdropRecipients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAirdropRecipient(index)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <p className="mt-2 text-xs text-slate-400">
              Specify addresses and amounts for token distribution
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isPending || isConfirming}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isSubmitting || isPending || isConfirming ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creating Proposal...</span>
            </>
          ) : (
            <>
              <span>🗳️</span>
              <span>Create Proposal</span>
            </>
          )}
        </button>

        <p className="text-xs text-slate-400 text-center">
          Creating a proposal will initiate a blockchain transaction that requires gas fees
        </p>
      </form>
    </div>
  );
};

export default CreateProposalForm;
