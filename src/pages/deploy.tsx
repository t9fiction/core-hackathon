import { useState } from 'react';
import DeployToken from '../components/DeployToken';

export default function Deploy() {
  const [totalSupply, setTotalSupply] = useState('1000000');

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <DeployToken totalSupply={totalSupply} />
      </div>
    </div>
  );
}
