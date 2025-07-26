import React from 'react';
import CustomButton from './subComponents/CustomButton';

const Navbar = () => {
  return (
    <nav className='sticky top-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-cyan-800'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          {/* Logo Section - Fixed Width */}
          <div className='flex-shrink-0 w-48'>
            <div className='flex items-center'>
              <div className='bg-cyan-800 w-8 h-8 rounded-lg flex items-center justify-center mr-3'>
                <span className='text-white font-bold text-lg'>P</span>
              </div>
              <span className='text-xl font-bold bg-cyan-800 bg-clip-text text-transparent'>
                PumpFun
              </span>
            </div>
          </div>
          
          {/* Center Navigation - Fixed Position */}
          <div className='absolute left-1/2 transform -translate-x-1/2'>
            <div className='flex items-center space-x-8'>
              <a 
                href='/' 
                className='text-white hover:text-cyan-800 transition-colors duration-200 font-medium'
              >
                HOME
              </a>
              <a 
                href='/token' 
                className='text-gray-300 hover:text-cyan-800 transition-colors duration-200 font-medium'
              >
                TOKEN
              </a>
              <a 
                href='/dex' 
                className='text-gray-300 hover:text-cyan-800 transition-colors duration-200 font-medium'
              >
                DEX
              </a>
              <a 
                href='/governance' 
                className='text-gray-300 hover:text-cyan-800 transition-colors duration-200 font-medium'
              >
                GOVERNANCE
              </a>
              <a 
                href='/docs' 
                className='text-gray-300 hover:text-cyan-800 transition-colors duration-200 font-medium'
              >
                DOCS
              </a>
            </div>
          </div>
          
          {/* Connect Button Section - Fixed Width */}
          <div className='flex-shrink-0 w-48 flex justify-end'>
            <div className='transform  transition-transform duration-200 cursor-pointer'>
              {/* <ConnectButton /> */}
              <CustomButton />
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu - Hidden by default, can be toggled */}
      <div className='md:hidden'>
        <div className='px-4 pt-2 pb-4 space-y-2 bg-gray-900/95 backdrop-blur-md border-t border-gray-800'>
          <a 
            href='/' 
            className='block px-3 py-2 text-white hover:text-cyan-800 transition-colors duration-200 font-medium'
          >
            HOME
          </a>
          <a 
            href='/token' 
            className='block px-3 py-2 text-gray-300 hover:text-cyan-800 transition-colors duration-200 font-medium'
          >
            TOKEN
          </a>
          <a 
            href='/governance' 
            className='block px-3 py-2 text-gray-300 hover:text-cyan-800 transition-colors duration-200 font-medium'
          >
            GOVERNANCE
          </a>
          <a 
            href='/docs' 
            className='block px-3 py-2 text-gray-300 hover:text-cyan-800 transition-colors duration-200 font-medium'
          >
            DOCS
          </a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;