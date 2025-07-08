import { ConnectButton } from '@rainbow-me/rainbowkit';
import React from 'react'

const CustomButton = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // Note: If your app doesn't use authentication, you
        // can remove all 'authenticationStatus' checks
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated');
        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              'style': {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button 
                    onClick={openConnectModal} 
                    type="button" 
                    className="flex items-center justify-center bg-cyan-800 hover:bg-cyan-800 border-white border-2 py-2 px-4 rounded transition-colors duration-200 min-w-[120px] h-[40px] text-sm sm:text-base whitespace-nowrap"
                  >
                    Connect Wallet
                  </button>
                );
              }
              if (chain.unsupported) {
                return (
                  <button 
                    onClick={openChainModal} 
                    type="button" 
                    className="flex items-center justify-center bg-red-300 hover:bg-red-400 border-white border-2 py-2 px-4 rounded transition-colors duration-200 min-w-[120px] h-[40px] text-sm sm:text-base whitespace-nowrap"
                  >
                    Wrong network
                  </button>
                );
              }
              return (
                <div className="flex items-center bg-cyan-800 hover:bg-cyan-800 border-white border-2 py-2 px-4 rounded transition-colors duration-200 min-w-[120px] h-[40px] gap-2 sm:gap-4">
                  <button
                    onClick={openChainModal}
                    className="flex items-center justify-center"
                    type="button"
                  >
                    {chain.hasIcon && (
                      <div
                        style={{
                          background: chain.iconBackground,
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}
                        className="sm:w-6 sm:h-6"
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    )}
                  </button>
                  <button 
                    onClick={openAccountModal} 
                    type="button"
                    className="text-sm sm:text-base truncate max-w-[80px] sm:max-w-[120px]"
                  >
                    {account.displayName}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  )
}

export default CustomButton