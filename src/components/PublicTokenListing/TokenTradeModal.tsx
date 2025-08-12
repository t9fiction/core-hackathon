import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { useReadContract } from 'wagmi';
import { CHAINCRAFT_TOKEN_ABI } from '../../lib/contracts/abis';
import { BuySellTokens } from '../BuySellTokens/BuySellTokens';

interface TokenTradeModalProps {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  isOpen: boolean;
  onClose: () => void;
  onTransactionComplete?: () => void;
}

const TokenTradeModal: React.FC<TokenTradeModalProps> = ({
  tokenAddress,
  tokenName,
  tokenSymbol,
  isOpen,
  onClose,
  onTransactionComplete
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  // Fetch token data directly from contract
  const { data: contractTokenName } = useReadContract({
    address: tokenAddress as Address,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'name',
    query: {
      enabled: !!tokenAddress && isOpen,
    },
  });

  const { data: contractTokenSymbol } = useReadContract({
    address: tokenAddress as Address,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!tokenAddress && isOpen,
    },
  });

  // Use contract data if props are empty or still loading
  const displayName = tokenName && tokenName !== 'Loading...' && tokenName !== '' 
    ? tokenName 
    : (contractTokenName as string) || 'Token';
  
  const displaySymbol = tokenSymbol && tokenSymbol !== 'Loading...' && tokenSymbol !== '' 
    ? tokenSymbol 
    : (contractTokenSymbol as string) || 'TOKEN';

  // Generate display initials for avatar
  const getDisplayInitials = (symbol: string) => {
    if (!symbol || symbol === 'TOKEN' || symbol === 'Loading...') {
      return '?';
    }
    return symbol.slice(0, 2).toUpperCase();
  };

  // Close modal with Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleTransactionComplete = () => {
    onTransactionComplete?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Simple backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal container */}
      <div className="relative w-full max-w-lg mx-4 sm:mx-6 max-h-[95vh] overflow-y-auto">
        <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl">
          
          {/* Simple Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-600">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-white">
                  {getDisplayInitials(displaySymbol)}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{displayName}</h2>
                <p className="text-sm text-slate-400">${displaySymbol}</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex p-6 pb-0">
            <div className="flex bg-slate-700 rounded-lg p-1 w-full">
              <button
                onClick={() => setActiveTab('buy')}
                className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'buy'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-600'
                }`}
              >
                Buy {displaySymbol}
              </button>
              <button
                onClick={() => setActiveTab('sell')}
                className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'sell'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-600'
                }`}
              >
                Sell {displaySymbol}
              </button>
            </div>
          </div>

          {/* Trading Interface */}
          <div className="p-6">
            <BuySellTokens
              tokenAddress={tokenAddress as Address}
              tokenName={displayName}
              tokenSymbol={displaySymbol}
              defaultTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as 'buy' | 'sell')}
              embedded={true}
              onTransactionComplete={handleTransactionComplete}
            />
          </div>

          {/* Footer */}
          <div className="p-6 pt-0 border-t border-slate-600">
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-300">Contract Address</span>
                <button
                  onClick={() => navigator.clipboard.writeText(tokenAddress)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  Copy
                </button>
              </div>
              <code className="text-xs text-slate-400 break-all block bg-slate-800 p-2 rounded border border-slate-600">
                {tokenAddress}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenTradeModal;
