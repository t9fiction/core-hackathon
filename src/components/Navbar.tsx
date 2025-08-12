import React, { useState } from 'react';
import CustomButton from './subComponents/CustomButton';
import Link from 'next/link';

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className='sticky top-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-cyan-800'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          {/* Logo Section */}
          <div className='flex-shrink-0'>
            <div className='flex items-center'>
              <div className='bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center mr-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-blue-500'>
                <svg className='w-5 h-5 text-white' viewBox='0 0 24 24' fill='none'>
                  {/* Circular chain of blocks */}
                  {/* Top block */}
                  <rect x='10' y='3' width='4' height='3' rx='0.5' fill='currentColor' opacity='0.9'/>
                  {/* Top-right block */}
                  <rect x='15' y='6' width='4' height='3' rx='0.5' fill='currentColor' opacity='0.8'/>
                  {/* Bottom-right block */}
                  <rect x='15' y='15' width='4' height='3' rx='0.5' fill='currentColor' opacity='0.9'/>
                  {/* Bottom block */}
                  <rect x='10' y='18' width='4' height='3' rx='0.5' fill='currentColor' opacity='0.8'/>
                  {/* Bottom-left block */}
                  <rect x='5' y='15' width='4' height='3' rx='0.5' fill='currentColor' opacity='0.9'/>
                  {/* Top-left block */}
                  <rect x='5' y='6' width='4' height='3' rx='0.5' fill='currentColor' opacity='0.8'/>
                  
                  {/* Connecting chain links (circular) */}
                  <path d='M12 6v3M16.5 9l-2 2M16.5 15l-2-2M12 18v-3M7.5 15l2-2M7.5 9l2 2' 
                        stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' opacity='0.7'/>
                  
                  {/* Central crafting element */}
                  <circle cx='12' cy='12' r='1.5' fill='currentColor'/>
                </svg>
              </div>
              <span className='text-xl font-bold bg-cyan-800 bg-clip-text text-transparent'>
                ChainCraft
              </span>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className='hidden lg:flex items-center space-x-8'>
            <Link 
              href='/' 
              className='text-white hover:text-cyan-400 transition-colors duration-200 font-medium'
            >
              HOME
            </Link>
            <Link 
              href='/token' 
              className='text-gray-300 hover:text-cyan-400 transition-colors duration-200 font-medium'
            >
              TOKEN
            </Link>
            <Link 
              href='/dex' 
              className='text-gray-300 hover:text-cyan-400 transition-colors duration-200 font-medium'
            >
              DEX
            </Link>
            <Link 
              href='/create-pool' 
              className='text-gray-300 hover:text-cyan-400 transition-colors duration-200 font-medium'
            >
              CREATE POOL
            </Link>
            <Link 
              href='/governance' 
              className='text-gray-300 hover:text-cyan-400 transition-colors duration-200 font-medium'
            >
              GOVERNANCE
            </Link>
            <Link 
              href='/docs' 
              className='text-gray-300 hover:text-cyan-400 transition-colors duration-200 font-medium'
            >
              DOCS
            </Link>
          </div>
          
          {/* Desktop Connect Button */}
          <div className='hidden md:flex flex-shrink-0'>
            <div className='transform transition-transform duration-200'>
              <CustomButton />
            </div>
          </div>

          {/* Mobile menu button */}
          <div className='lg:hidden flex items-center space-x-4'>
            {/* Mobile Connect Button */}
            <div className='md:hidden'>
              <CustomButton />
            </div>
            <button
              onClick={toggleMobileMenu}
              className='text-gray-300 hover:text-white focus:outline-none focus:text-white transition-colors duration-200'
              aria-label='Toggle mobile menu'
            >
              {isMobileMenuOpen ? (
                <svg className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              ) : (
                <svg className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      <div className={`lg:hidden transition-all duration-300 ease-in-out ${
        isMobileMenuOpen 
          ? 'max-h-96 opacity-100' 
          : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className='px-4 pt-2 pb-4 space-y-2 bg-gray-900/95 backdrop-blur-md border-t border-gray-800'>
          <Link 
            href='/' 
            className='block px-3 py-2 text-white hover:text-cyan-400 hover:bg-gray-800/50 rounded-md transition-colors duration-200 font-medium'
            onClick={() => setIsMobileMenuOpen(false)}
          >
            HOME
          </Link>
          <Link 
            href='/token' 
            className='block px-3 py-2 text-gray-300 hover:text-cyan-400 hover:bg-gray-800/50 rounded-md transition-colors duration-200 font-medium'
            onClick={() => setIsMobileMenuOpen(false)}
          >
            TOKEN
          </Link>
          <Link 
            href='/dex' 
            className='block px-3 py-2 text-gray-300 hover:text-cyan-400 hover:bg-gray-800/50 rounded-md transition-colors duration-200 font-medium'
            onClick={() => setIsMobileMenuOpen(false)}
          >
            DEX
          </Link>
          <Link 
            href='/create-pool' 
            className='block px-3 py-2 text-gray-300 hover:text-cyan-400 hover:bg-gray-800/50 rounded-md transition-colors duration-200 font-medium'
            onClick={() => setIsMobileMenuOpen(false)}
          >
            CREATE POOL
          </Link>
          <Link 
            href='/governance' 
            className='block px-3 py-2 text-gray-300 hover:text-cyan-400 hover:bg-gray-800/50 rounded-md transition-colors duration-200 font-medium'
            onClick={() => setIsMobileMenuOpen(false)}
          >
            GOVERNANCE
          </Link>
          <Link 
            href='/docs' 
            className='block px-3 py-2 text-gray-300 hover:text-cyan-400 hover:bg-gray-800/50 rounded-md transition-colors duration-200 font-medium'
            onClick={() => setIsMobileMenuOpen(false)}
          >
            DOCS
          </Link>
          {/* Mobile Connect Button for medium screens */}
          <div className='hidden sm:block md:hidden pt-4 border-t border-gray-800'>
            <CustomButton />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;