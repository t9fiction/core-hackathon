import React from 'react';
import { useAccount } from 'wagmi';
import { useSmartContractRead } from '../lib/hooks/useSmartContract';
import { CHAINCRAFT_TOKEN_ABI } from '../lib/contracts/abis';
import { formatEther, Address } from 'viem';

interface TokenBalanceCheckerProps {
  tokenAddress: string;
  tokenName?: string;
}

const TokenBalanceChecker: React.FC<TokenBalanceCheckerProps> = ({ 
  tokenAddress, 
  tokenName = 'Token' 
}) => {
  const { address } = useAccount();

  // Get total supply
  const { data: totalSupply } = useSmartContractRead({
    address: tokenAddress as Address,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'totalSupply',
  });

  // Get user balance
  const { data: userBalance } = useSmartContractRead({
    address: tokenAddress as Address,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Get token owner
  const { data: tokenOwner } = useSmartContractRead({
    address: tokenAddress as Address,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'owner',
  });

  // Get owner balance (to verify tokens were minted to owner)
  const { data: ownerBalance } = useSmartContractRead({
    address: tokenAddress as Address,
    abi: CHAINCRAFT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: tokenOwner ? [tokenOwner as Address] : undefined,
  });

  return (
    <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
      <h4 className="text-white font-semibold mb-3">
        🔍 Balance Verification: {tokenName}
      </h4>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-300">Total Supply:</span>
          <span className="text-white font-mono">
            {totalSupply ? formatEther(totalSupply as bigint) : 'Loading...'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-slate-300">Token Owner:</span>
          <span className="text-white font-mono text-xs">
            {tokenOwner ? `${(tokenOwner as string).slice(0, 6)}...${(tokenOwner as string).slice(-4)}` : 'Loading...'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-slate-300">Owner Balance:</span>
          <span className="text-white font-mono">
            {ownerBalance ? formatEther(ownerBalance as bigint) : 'Loading...'}
          </span>
        </div>

        {address && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-300">Your Address:</span>
              <span className="text-white font-mono text-xs">
                {`${address.slice(0, 6)}...${address.slice(-4)}`}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-300">Your Balance:</span>
              <span className="text-white font-mono">
                {userBalance ? formatEther(userBalance as bigint) : '0'}
              </span>
            </div>
          </>
        )}

        {/* Verification Status */}
        {totalSupply && ownerBalance ? (
          <div className="mt-3 pt-3 border-t border-slate-600">
            {totalSupply.toString() === ownerBalance.toString() ? (
              <div className="flex items-center space-x-2">
                <span className="text-green-400">✅</span>
                <span className="text-green-300 text-xs">
                  Verified: All tokens minted to owner
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-yellow-400">⚠️</span>
                <span className="text-yellow-300 text-xs">
                  Tokens have been distributed from owner
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TokenBalanceChecker;
