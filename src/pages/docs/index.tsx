import React from 'react';

const Docs = () => {
  return (
    <div className='px-8 py-6 space-y-8'>
      <section className='text-center'>
        <h1 className='text-4xl font-bold mb-4'>Documentation</h1>
        <p className='text-lg text-gray-300'>Welcome to the PumpFun Documentation. Here you'll find comprehensive guides and documentation to help you start working with PumpFun as quickly as possible.</p>
      </section>

      <section>
        <h2 className='text-2xl font-semibold mb-2'>Getting Started</h2>
        <p className='text-gray-400'>Begin by setting up your environment, installing dependencies, and understanding how to use basic features.</p>
      </section>

      <section>
        <h2 className='text-2xl font-semibold mb-2'>Features</h2>
        <ul className='list-disc list-inside space-y-1 text-gray-400'>
          <li>Token Management</li>
          <li>Decentralized Exchange (DEX)</li>
          <li>Governance</li>
          <li>Token Locking</li>
        </ul>
      </section>

      <section>
        <h2 className='text-2xl font-semibold mb-2'>Resources</h2>
        <p className='text-gray-400'>Access our tutorials, FAQs, and community discussions.</p>
      </section>
    </div>
  );
};

export default Docs;
