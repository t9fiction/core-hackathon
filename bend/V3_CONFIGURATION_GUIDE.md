# PumpFun UniswapV3 Integration Guide

## Overview

This project uses UniswapV3 for DEX integration. The implementation provides:

- Concentrated liquidity positions
- Multiple fee tiers (0.05%, 0.3%, 1%)
- Advanced token swapping
- Better capital efficiency
- NFT-based position management

## Architecture

### Core Contracts

1. **PumpFunDEXManager.sol** - UniswapV3 integration
2. **PumpFunFactoryLite.sol** - Factory with V3 DEX support
3. **PumpFunToken.sol** - Enhanced ERC20 token

### V3 Interfaces

- `IUniswapV3Factory.sol` - Factory interface for V3 pools
- `IUniswapV3Pool.sol` - Pool interface for V3
- `ISwapRouter.sol` - Router interface for V3 swaps
- `INonfungiblePositionManager.sol` - Position manager for liquidity

### Mock Contracts (for testing)

- `SwapRouterMock.sol` - Mock swap router
- `NonfungiblePositionManagerMock.sol` - Mock position manager
- `WETHMock.sol` - Mock WETH token
- `ERC20Mock.sol` - Mock ERC20 token

## Configuration

### Network Addresses

#### Ethereum Mainnet
```
SwapRouter: 0xE592427A0AEce92De3Edee1F18E0157C05861564
NonfungiblePositionManager: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
```

#### Sepolia Testnet
```
SwapRouter: 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
NonfungiblePositionManager: 0x1238536071E1c677A632429e3655c799b22cDA52
WETH: 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
```

### Environment Variables

Create a `.env` file with:
```bash
UNISWAP_V3_SWAP_ROUTER=0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
UNISWAP_V3_POSITION_MANAGER=0x1238536071E1c677A632429e3655c799b22cDA52
WETH_ADDRESS=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
```

## Deployment

### Deploy DEX Manager

```bash
npm run deploy:dex:sepolia
```

### Deploy with Custom Parameters

```bash
npx hardhat ignition deploy ignition/modules/PumpFunDEXManager.ts --network sepolia --parameters '{"_swapRouter": "0x...", "_positionManager": "0x...", "_weth": "0x..."}'
```

## Usage

### Factory Configuration

```solidity
// Set DEX manager
factory.setDEXManager(dexManagerAddress);
```

### Creating Liquidity Pools

```solidity
// Authorize token first
dexManager.authorizeToken(tokenAddress);

// Create pool with fee tier
dexManager.createLiquidityPool(
    token0,
    token1,
    3000, // 0.3% fee
    amount0Desired,
    amount1Desired
);
```

### Token Swapping

```solidity
// ETH to tokens
dexManager.swapExactETHForTokens{value: ethAmount}(
    tokenOut,
    3000, // fee tier
    amountOutMinimum
);

// Tokens to ETH
dexManager.swapExactTokensForETH(
    tokenIn,
    3000, // fee tier
    amountIn,
    amountOutMinimum
);
```

## Fee Tiers

UniswapV3 supports multiple fee tiers:

- **500 (0.05%)** - For very stable pairs
- **3000 (0.3%)** - For most pairs
- **10000 (1%)** - For exotic pairs

## Testing

### Run DEX Tests

```bash
npm run test:dex
```

### Run Integration Tests

```bash
npx hardhat test test/DEXIntegration.test.js
```

### Run All Tests

```bash
npm test
```

## Key Features

### Key Advantages

1. **Concentrated Liquidity**: More capital efficient than traditional AMMs
2. **Multiple Fee Tiers**: Better price discovery and flexibility
3. **Advanced Position Management**: NFT-based liquidity positions
4. **Better Slippage**: Improved efficiency for large trades
5. **Lower Gas Costs**: Optimized for modern DeFi operations

## Gas Optimization

V3 operations are generally more gas efficient for:
- Large swaps
- Concentrated liquidity provision
- Fee collection

## Security Considerations

1. **Position Management**: V3 positions are NFTs
2. **Price Impact**: Better handling in V3
3. **MEV Protection**: Improved with concentrated liquidity
4. **Slippage**: More predictable in V3

## Monitoring

Monitor V3 positions using:
- Position ID tracking
- Liquidity utilization
- Fee collection
- Price range efficiency

## Support

For issues or questions regarding V3 integration:
1. Check test files for examples
2. Review mock contracts for development
3. Use testnet for initial deployment
4. Monitor gas usage and optimization opportunities

## Migration Guide

To migrate from V2 to V3:

1. Deploy V3 manager
2. Configure factory with V3 manager
3. Authorize existing tokens in V3
4. Create new V3 pools
5. Migrate liquidity gradually
6. Toggle factory to use V3

The system supports gradual migration without disrupting existing V2 operations.
