# ChainCraft Factory 🚀

**A comprehensive anti-rug pull meme token factory with built-in safety mechanisms, community governance, and tiered pricing.**

ChainCraft Factory enables users to create sustainable meme tokens with advanced protection mechanisms against rug pulls, community governance systems, and automated liquidity management.

## ✨ Key Features

### 🔒 Anti-Rug Pull Protection
- **Liquidity Locking**: Mandatory liquidity locks (minimum 30 days)
- **Transfer Restrictions**: 1% max transfer, 5% max holding, 1-hour cooldowns
- **Emergency Controls**: Pause/unpause functionality for crisis management
- **Whitelist System**: Bypass restrictions for trusted addresses
- **Creator Limits**: Controlled token allocation (10% creator, 20% liquidity, 70% community)

### 🏛️ Community Governance
- **Proposal System**: Token holders can create and vote on proposals
- **Quorum Requirements**: 10% of total supply needed for valid votes
- **Token-Weighted Voting**: Democratic decision making
- **7-Day Voting Periods**: Adequate time for community participation

### 💰 Tiered Pricing System
- **Standard Tier**: Up to 100M tokens - 0.05 ETH
- **Premium Tier**: Up to 500M tokens - 0.15 ETH
- **Ultimate Tier**: Up to 1B tokens - 0.50 ETH

### 📊 Stability Mechanisms
- **Token Locking**: Users can lock tokens for rewards (1 day to 365 days)
- **Mint/Burn Controls**: Price-reactive supply adjustments
- **Target Price System**: Built-in price stabilization

## 🏗️ Architecture

### Frontend (Next.js + RainbowKit)
- **Web3 Integration**: RainbowKit + wagmi for wallet connections
- **Modern UI**: TailwindCSS with responsive design
- **Token Management**: Deploy, manage, and trade tokens
- **Governance Interface**: Participate in community decisions
- **Trading Dashboard**: Monitor and trade tokens

### Backend (Hardhat + Solidity)
- **ChainCraftFactoryLite**: Main factory contract for token deployment
- **ChainCraftToken**: Enhanced ERC20 with anti-rug pull features
- **ChainCraftDEXManager**: DEX integration and liquidity management
- **ChainCraftGovernance**: Community governance system

## 🚀 Quick Start

### Prerequisites
- Node.js v16+
- npm or yarn
- MetaMask or compatible Web3 wallet

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to testnet
npm run deploy:sepolia
```

## 📱 Application Pages

- **Homepage**: Overview and quick actions
- **Deploy Token** (`/token`): Create new meme tokens
- **My Tokens** (`/tokens`): Manage deployed tokens
- **Governance** (`/governance`): Community proposals and voting
- **Trading** (`/trading`): Token trading and liquidity management

## 🛠️ Smart Contracts

### ChainCraftFactoryLite
```solidity
// Deploy a new token with anti-rug pull features
function deployToken(
    string memory name,
    string memory symbol,
    uint256 totalSupply,
    uint256 liquidityLockPeriodDays
) external payable
```

### ChainCraftToken
```solidity
// Lock tokens for rewards
function lockTokens(uint256 amount, uint256 duration) external

// Governance voting
function vote(uint256 proposalId, bool support) external
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:token
npm run test:factory
npm run test:integration

# Generate coverage report
npm run test:coverage
```

**Test Results**: 70/85 tests passing (82.4% success rate)

## 🌐 Deployment

### Supported Networks
- Core Dao


## 🔐 Security Features

- **Supply Locking**: Time-based token locking mechanism
- **Transfer Limits**: Prevents large dumps and manipulation
- **Emergency Controls**: Pause functionality for crisis management
- **Liquidity Protection**: Mandatory liquidity locking
- **Community Oversight**: Governance-based decision making

## 📈 Token Economics

### Supply Tiers
| Tier | Max Supply | Fee | Features |
|------|------------|-----|----------|
| Standard | 100M | 0.05 ETH | Basic protection, 30-day liquidity lock |
| Premium | 500M | 0.15 ETH | Enhanced features, priority support |
| Ultimate | 1B | 0.50 ETH | Maximum supply, VIP support |

### Token Distribution
- **70%** Community/Public
- **20%** Liquidity Pool
- **10%** Creator/Team

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Frontend Documentation](./src/README.md)
- [Backend Documentation](./backend/README.md)
- [Smart Contract Tests](./backend/TEST_README.md)
- [Goal Analysis](./backend/GOAL_ANALYSIS.md)

## ⚠️ Disclaimer

This is experimental software. Use at your own risk. Always do your own research before deploying tokens or providing liquidity.

---

**Built with ❤️ for the meme token community**
