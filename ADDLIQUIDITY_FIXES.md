# addLiquidity Function Issues and Fixes

## Issues Identified

### 1. **Logic Error in Pool Existence Check (Line 296)**

**Problem:** The contract's `addLiquidity` function had this incorrect condition:
```solidity
if (!tokenPools[orderedToken0][orderedToken1][fee].isActive) revert PumpFunDEXManager__PairAlreadyExists();
```

This was checking if the pool is NOT active but throwing a "PairAlreadyExists" error, which is misleading and incorrect logic.

**Fix:** Changed to:
```solidity
if (!tokenPools[orderedToken0][orderedToken1][fee].isActive) revert PumpFunDEXManager__PoolDoesNotExist();
```

### 2. **WETH Handling Issue**

**Problem:** The smart contract expected both tokens to be transferred via `transferFrom`, but when dealing with ETH, the contract should handle WETH wrapping properly.

**Fix:** Added proper ETH/WETH handling:
```solidity
// Handle ETH/WETH conversion
if (token0 == WETH && msg.value > 0) {
    if (msg.value != tokenAmount0) revert PumpFunDEXManager__InvalidAmount();
    IWETH(WETH).deposit{value: msg.value}();
    IERC20(token1).transferFrom(msg.sender, address(this), tokenAmount1);
} else if (token1 == WETH && msg.value > 0) {
    if (msg.value != tokenAmount1) revert PumpFunDEXManager__InvalidAmount();
    IWETH(WETH).deposit{value: msg.value}();
    IERC20(token0).transferFrom(msg.sender, address(this), tokenAmount0);
} else {
    // Both tokens are ERC20
    IERC20(token0).transferFrom(msg.sender, address(this), tokenAmount0);
    IERC20(token1).transferFrom(msg.sender, address(this), tokenAmount1);
}
```

### 3. **Amount Ordering Issue**

**Problem:** The amounts weren't being properly ordered when passed to the Uniswap position manager.

**Fix:** Added proper amount ordering logic:
```solidity
// Properly order the amounts based on the ordered tokens
uint256 amount0Desired;
uint256 amount1Desired;

if (token0 < token1) {
    amount0Desired = tokenAmount0;
    amount1Desired = tokenAmount1;
} else {
    amount0Desired = tokenAmount1;
    amount1Desired = tokenAmount0;
}
```

### 4. **Frontend Parameter Handling**

**Problem:** The frontend was not correctly handling WETH amounts and token ordering.

**Fix:** Updated frontend to:
- Only approve the actual token (not WETH, as it gets wrapped automatically)
- Properly calculate amounts based on token ordering
- Send ETH value for automatic WETH wrapping
- Add better logging for debugging

```typescript
// Determine the correct amounts based on token ordering
const tokenAmount0 = isToken0 ? tokenAmountWei : ethAmountWei;
const tokenAmount1 = isToken0 ? ethAmountWei : tokenAmountWei;

const tx = await writeContractAsync({
  address: contractAddresses.PUMPFUN_DEX_MANAGER,
  abi: PUMPFUN_DEX_MANAGER_ABI,
  functionName: "addLiquidity",
  args: [token0, token1, fee, tokenAmount0, tokenAmount1],
  value: ethAmountWei, // Send ETH with the transaction for WETH wrapping
});
```

## Files Changed

1. **Smart Contract:** `/backend/contracts/PumpFunDEXManager.sol`
   - Fixed logic error in pool existence check
   - Added proper WETH handling
   - Fixed amount ordering for Uniswap integration

2. **Frontend Hook:** `/src/lib/hooks/useTokenContracts.ts`
   - Updated `addLiquidity` function to properly handle WETH amounts
   - Added better error handling and logging
   - Fixed token approval logic

3. **ABI Definition:** `/src/lib/contracts/abis/dex.ts`
   - Added missing `PumpFunDEXManager__PoolDoesNotExist` error
   - Removed duplicate entries

## Expected Behavior After Fixes

1. **Pool Creation:** When no pool exists, it will create one using `createLiquidityPoolWithETH`
2. **Pool Addition:** When pool exists, it will add liquidity properly with automatic WETH wrapping
3. **Error Handling:** Proper error messages for pool existence checks
4. **ETH Handling:** Automatic conversion of ETH to WETH within the contract
5. **Amount Ordering:** Correct ordering of token amounts based on address comparison

## Testing Recommendations

1. Test with a token that has no existing pool (should create pool first)
2. Test with a token that has an existing pool (should add liquidity)
3. Test with different ETH amounts to ensure proper WETH conversion
4. Verify that the correct error messages are displayed for various failure scenarios

These fixes should resolve the addLiquidity function issues and allow proper liquidity addition to both new and existing pools.
