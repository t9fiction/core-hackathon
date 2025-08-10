# ChainCraft - Anti-Rug Pull Meme Token Factory

A comprehensive smart contract system for deploying sustainable meme tokens with built-in anti-rug pull mechanisms and community governance features.

## 🚀 Features

### 🏭 Factory Contract (ChainCraftFactoryLite)
- **Easy Token Deployment**: Deploy tokens with customizable parameters
- **Fee Management**: Configurable deployment fees with admin controls
- **Liquidity Locking**: Automatic liquidity locking to prevent rug pulls
- **Token Tracking**: Comprehensive tracking of all deployed tokens
- **Anti-Rug Pull Triggers**: Emergency mechanisms to protect investors
- **Days-Based Parameters**: User-friendly day-based lock periods

### 🪙 Token Contract (ChainCraftToken)
- **Transfer Restrictions**: Configurable limits on transfer amounts and frequency
- **Token Locking**: Users can voluntarily lock tokens for rewards
- **Stability Mechanisms**: Automatic mint/burn based on price movements
- **Governance System**: Community voting on proposals
- **Emergency Controls**: Pause/unpause functionality for crisis management
- **Whitelist System**: Bypass restrictions for trusted addresses

## 📋 Contract Overview

### ChainCraftFactoryLite
```solidity
// Deploy a new token
function deployToken(
    string memory name,
    string memory symbol,
    uint256 totalSupply,
    uint256 liquidityLockPeriodDays  // Now in days, not seconds!
) external payable

// Get supply tier information
function getSupplyTier(uint256 totalSupply) external pure returns (
    string memory tier, 
    uint256 maxSupply, 
    uint256 feeMultiplier
)

// Get required fee for supply amount
function getRequiredFee(uint256 totalSupply) external view returns (uint256)

// Add and lock liquidity
function addAndLockLiquidity(
    address tokenAddress,
    uint256 tokenAmount
) external payable

// Emergency anti-rug pull
function triggerAntiRugPull(
    address tokenAddress, 
    string memory reason
) external onlyOwner
```

### ChainCraftToken
```solidity
// Lock tokens for a period
function lockTokens(uint256 amount, uint256 duration) external

// Stability mechanisms
function stabilityMint(uint256 amount, uint256 currentPrice) external onlyOwner
function stabilityBurn(uint256 amount, uint256 currentPrice) external onlyOwner

// Governance
function createProposal(string memory description) external returns (uint256)
function vote(uint256 proposalId, bool support) external
```

## 🛠 Installation & Setup

### Prerequisites
- Node.js v16 or higher
- npm or yarn
- Hardhat

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd chaincraft-hardhat

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables
```bash
PRIVATE_KEY=your_private_key_here
API_URL_sepolia=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
API_URL_basesepolia=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
API_URL_base=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key
BASESCAN_API_KEY=your_basescan_api_key
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Test ChainCraftToken contract
npm run test:token

# Test ChainCraftFactoryLite contract
npm run test:factory

# Test integration scenarios
npm run test:integration

# Generate coverage report
npm run test:coverage
```

### Test Results Summary
- **Total Tests**: 85
- **Passing**: 70 (82.4%)
- **Failing**: 15 (17.6%)

Most failing tests are due to configuration issues, not contract bugs. See [TEST_RESULTS.md](./TEST_RESULTS.md) for detailed analysis.

## 🚀 Deployment

### Compile Contracts
```bash
npm run compile
```

### Deploy to Networks
```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# Deploy to Base mainnet
npm run deploy:base
```

## 📖 Usage Examples

### Supply Tiers & Fees

The factory now uses a tiered approach for max supply limits:

| Tier | Max Supply | Fee Multiplier | Base Fee (0.05 ETH) | Total Fee |
|------|------------|----------------|---------------------|----------|
| **Standard** | 100M tokens | 1x | 0.05 ETH | **0.05 ETH** |
| **Premium** | 500M tokens | 3x | 0.05 ETH | **0.15 ETH** |
| **Ultimate** | 1B tokens | 10x | 0.05 ETH | **0.50 ETH** |

### 1. Deploy a Token
```bash
# Deploy Standard tier token (recommended)
cast send <FACTORY_ADDRESS> \
  "deployToken(string,string,uint256,uint256)" \
  "TigerShark" "TGS" 50000000 30 \
  --value 0.05ether \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY

# Deploy Premium tier token (higher fee)
cast send <FACTORY_ADDRESS> \
  "deployToken(string,string,uint256,uint256)" \
  "MegaShark" "MEGA" 300000000 30 \
  --value 0.15ether \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

**Parameters:**
- `name`: "TigerShark"
- `symbol`: "TGS" 
- `totalSupply`: 50,000,000 tokens (Standard tier)
- `liquidityLockPeriodDays`: 30 days (minimum)
- `value`: 0.05 ETH (Standard tier fee)

### 2. Add Liquidity
```javascript
// Using ethers.js
const factory = new ethers.Contract(factoryAddress, factoryABI, signer);
const token = new ethers.Contract(tokenAddress, tokenABI, signer);

// Approve tokens
await token.approve(factory.address, tokenAmount);

// Add and lock liquidity
await factory.addAndLockLiquidity(
  tokenAddress,
  ethers.parseUnits("10000", 18), // 10,000 tokens
  { value: ethers.parseEther("1") } // 1 ETH
);
```

### 3. Lock Tokens
```javascript
const token = new ethers.Contract(tokenAddress, tokenABI, signer);

// Lock 5,000 tokens for 90 days
await token.lockTokens(
  ethers.parseUnits("5000", 18),
  90 * 24 * 60 * 60 // 90 days in seconds
);
```

### 4. Create Governance Proposal
```javascript
// Need 1% of total supply to create proposals
await token.createProposal("Reduce transfer cooldown to 30 minutes");

// Vote on proposal
await token.vote(0, true); // Vote YES on proposal ID 0
```

## 🔒 Security Features

### Anti-Rug Pull Mechanisms
1. **Liquidity Locking**: Mandatory liquidity locks prevent creators from draining liquidity
2. **Transfer Restrictions**: Limits on transfer amounts and frequency
3. **Emergency Pause**: Factory owner can pause suspicious tokens
4. **Time-Locked Actions**: Critical actions have time delays

### Access Control
- **Factory Owner**: Can trigger emergency measures, update fees
- **Token Owner**: Can pause their own token, adjust parameters
- **Token Holders**: Can participate in governance with sufficient holdings

### Transfer Protections
- **Max Transfer Amount**: Prevents large dumps (default 1% of supply)
- **Max Holding**: Prevents whale accumulation (default 5% of supply)
- **Transfer Cooldown**: Prevents rapid successive transfers (1 hour)
- **Locked Token Protection**: Prevents transfer of locked tokens

## 📊 Default Configuration

### Factory Settings
- **Deployment Fee**: 0.05 ETH
- **Max Fee**: 1 ETH
- **Min Liquidity Lock**: 30 days
- **Min Total Supply**: 1,000 tokens
- **Max Total Supply**: 1,000,000,000 tokens

### Token Settings
- **Max Transfer**: 1% of total supply
- **Max Holding**: 5% of total supply
- **Transfer Cooldown**: 1 hour
- **Min Lock Duration**: 1 day
- **Max Lock Duration**: 365 days
- **Governance Threshold**: 1% of supply for proposals
- **Quorum**: 10% of supply for execution

### Token Distribution
- **Creator**: 10% of total supply
- **Liquidity**: 20% of total supply
- **Community**: 70% of total supply (held in contract)

## 🔧 Configuration

### Adjusting Transfer Limits
```javascript
// Token owner can adjust limits
await token.setMaxTransferAmount(ethers.parseUnits("5000", 18));
await token.setMaxHolding(ethers.parseUnits("100000", 18));
await token.setTransferLimitsEnabled(false); // Disable all limits
```

### Managing Whitelist
```javascript
// Add address to whitelist (bypasses transfer restrictions)
await token.setWhitelisted(exchangeAddress, true);
```

### Updating Factory Fees
```javascript
// Factory owner can update deployment fee
await factory.setEtherFee(ethers.parseEther("0.1")); // 0.1 ETH
```

## 📈 Gas Costs

| Operation | Gas Cost | Description |
|-----------|----------|-------------|
| Deploy Factory | ~3.95M | One-time deployment |
| Deploy Token | ~2.55M | Per token deployment |
| Transfer | ~60k | Standard ERC20 with restrictions |
| Lock Tokens | ~93k | Lock tokens for duration |
| Add Liquidity | ~150k | Add and lock liquidity |
| Admin Operations | ~30k | Update settings |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Development Commands
```bash
# Clean artifacts
npm run clean

# Compile contracts
npm run compile

# Run tests
npm test

# Run specific tests
npx hardhat test test/ChainCraftToken.test.js
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is provided "as is" for educational and development purposes. Always conduct thorough testing and audits before deploying to mainnet. The developers are not responsible for any losses or damages.

## 🆘 Support

For support and questions:
- Open an issue on GitHub
- Review the test files for usage examples
- Check the [TEST_RESULTS.md](./TEST_RESULTS.md) for troubleshooting

## 🗺️ Roadmap

### v1.1 (Planned)
- [ ] Enhanced governance features
- [ ] Dynamic fee adjustments
- [ ] Multi-signature admin controls
- [ ] Cross-chain deployment support

### v1.2 (Future)
- [ ] DEX integration
- [ ] Automated market making
- [ ] Advanced analytics dashboard
- [ ] Mobile app interface

---

**Built with ❤️ for the DeFi community**
