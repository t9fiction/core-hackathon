import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  coreTestnet2,
  coreDao,
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'ChainCraft - Core DAO Token Management',
  projectId: 'b733907b13ef59931a5ab9c55db6f28c',
  chains: [
    coreDao, // Core DAO Mainnet (Chain ID: 1116)
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [coreTestnet2] : []), // Core DAO Testnet (Chain ID: 1114)
  ],
  ssr: true,
});
