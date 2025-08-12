# SushiSwap RouteProcessor7 Integration

## Overview

The ChainCraftDEXManager has been updated to integrate with SushiSwap's RouteProcessor7 on Core DAO mainnet. This provides access to SushiSwap's advanced routing capabilities for optimal token swaps.

## Contract Addresses (Core DAO Mainnet)

- **RouteProcessor7**: `0x3ced11c610556e5292fbc2e75d68c3899098c14c`
- **Wrapped CORE (WCORE)**: `0x40375c92d9faf44d2f9db9bd9ba41a3317a2404f`

## Key Features

### 1. Simplified Architecture
- Removed complex Uniswap V3 liquidity management
- Focus on routing through SushiSwap's optimized system
- Cleaner, more maintainable codebase

### 2. Core Functions

#### `swap(tokenIn, tokenOut, amountIn, route)`
- General-purpose swap function
- Requires route data from SushiSwap's routing API
- Handles both ERC20 and native ETH swaps

#### `swapETHForTokens(tokenOut, route)`
- Simplified ETH → Token swaps
- Automatically wraps ETH to WCORE
- Direct recipient delivery

#### `swapTokensForETH(tokenIn, amountIn, route)`
- Simplified Token → ETH swaps
- Automatically unwraps WCORE to ETH
- Direct ETH delivery to user

### 3. Route Data Generation

To use these functions, you need to generate route data off-chain using SushiSwap's routing API:

```javascript
// Example: Get route data for ETH -> TOKEN swap
const routeData = await fetch(`https://api.sushi.com/route`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokenIn: '0x40375c92d9faf44d2f9db9bd9ba41a3317a2404f', // WCORE
    tokenOut: '0x...', // Your token address
    amount: '1000000000000000000', // 1 ETH in wei
    recipient: '0x...', // User address
    slippageTolerance: '0.5' // 0.5%
  })
});
```

## Usage Examples

### Deploying the Contract

```bash
npx hardhat ignition deploy ./ignition/modules/DeployWithSushiCoreMainnet.ts --network core_mainnet
```

### Interacting with the Contract

```solidity
// Authorize a token for trading
dexManager.authorizeToken(tokenAddress);

// Swap ETH for tokens
uint256 amountOut = dexManager.swapETHForTokens{value: 1 ether}(
    tokenAddress,
    routeData
);

// Swap tokens for ETH
uint256 amountOut = dexManager.swapTokensForETH(
    tokenAddress,
    tokenAmount,
    routeData
);
```

## Benefits of RouteProcessor7

1. **Optimized Routing**: Automatically finds the best swap paths
2. **Gas Efficiency**: Single transaction for complex multi-hop swaps
3. **Better Prices**: Access to multiple liquidity sources
4. **Slippage Protection**: Built-in price impact protection
5. **Future-Proof**: Compatible with new DEX protocols as they're added

## Important Notes

1. **Route Data**: Always generate fresh route data from SushiSwap's API
2. **Slippage**: RouteProcessor7 handles slippage protection internally
3. **Gas**: Multi-hop swaps may require higher gas limits
4. **Authorization**: Tokens must be authorized before trading

## Migration from Uniswap V3

The new system is much simpler:
- No more complex liquidity management
- No more manual price calculations
- No more pool creation and initialization
- Focus on what matters: efficient token swaps

## Testing

Use the Core DAO testnet for initial testing:
```bash
npx hardhat ignition deploy ./ignition/modules/DeployOnSushiCoreTestnet2.ts --network core_testnet
```

## Security Considerations

- Only authorized tokens can be traded
- Owner can withdraw stuck funds in emergencies
- ReentrancyGuard protects against reentrancy attacks
- Proper ETH/WETH handling prevents fund loss
