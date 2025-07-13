const { expect } = require("chai");
const { ethers } = require("hardhat");

// Test suite for PumpFunDEXManager
describe("PumpFunDEXManager", function () {
  let dexManager, owner, addr1, token0, token1, weth, swapRouter, positionManager;
  const fee = 3000;
  const amount0Desired = ethers.parseEther("100");
  const amount1Desired = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    // Deploy mock contracts
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const WETHMock = await ethers.getContractFactory("WETHMock");
    const SwapRouterMock = await ethers.getContractFactory("SwapRouterMock");
    const NonfungiblePositionManagerMock = await ethers.getContractFactory("NonfungiblePositionManagerMock");
    
    // Deploy tokens
    token0 = await ERC20Mock.deploy("Token0", "TK0", owner.address, ethers.parseEther("10000"));
    token1 = await ERC20Mock.deploy("Token1", "TK1", owner.address, ethers.parseEther("10000"));
    weth = await WETHMock.deploy();
    
    // Deploy mocks
    swapRouter = await SwapRouterMock.deploy(weth.target);
    positionManager = await NonfungiblePositionManagerMock.deploy(ethers.ZeroAddress, weth.target);
    
    // Add tokens to swap router for testing
    await token0.approve(swapRouter.target, ethers.parseEther("1000"));
    await token1.approve(swapRouter.target, ethers.parseEther("1000"));
    await swapRouter.addTokens(token0.target, ethers.parseEther("1000"));
    await swapRouter.addTokens(token1.target, ethers.parseEther("1000"));
    
    // Deploy DexManager
    const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
    dexManager = await PumpFunDEXManager.deploy(
      swapRouter.target,
      positionManager.target,
      weth.target
    );
  });

  it("Should authorize tokens", async function () {
    await dexManager.connect(owner).authorizeToken(token0.target);
    expect(await dexManager.authorizedTokens(token0.target)).to.be.true;
  });

  it("Should create a liquidity pool", async function () {
    await dexManager.connect(owner).authorizeToken(token0.target);

    await token0.approve(dexManager.target, amount0Desired);
    await token1.approve(dexManager.target, amount1Desired);

    await expect(
      dexManager.createLiquidityPool(
        token0.target,
        token1.target,
        fee,
        amount0Desired,
        amount1Desired
      )
    ).to.emit(dexManager, "LiquidityPoolCreated");
  });

  it("Should add liquidity to existing pool", async function () {
    await dexManager.connect(owner).authorizeToken(token0.target);
    
    // First create the pool
    await token0.approve(dexManager.target, amount0Desired);
    await token1.approve(dexManager.target, amount1Desired);
    await dexManager.createLiquidityPool(token0.target, token1.target, fee, amount0Desired, amount1Desired);
    
    // Add more liquidity
    const additionalAmount0 = ethers.parseEther("50");
    const additionalAmount1 = ethers.parseEther("50");
    await token0.approve(dexManager.target, additionalAmount0);
    await token1.approve(dexManager.target, additionalAmount1);
    
    await expect(
      dexManager.addLiquidity(
        token0.target,
        token1.target,
        fee,
        additionalAmount0,
        additionalAmount1
      )
    ).to.emit(dexManager, "LiquidityAdded");
  });

  it("Should swap exact ETH for tokens", async function () {
    await dexManager.connect(owner).authorizeToken(token1.target);
    
    const ethAmount = ethers.parseEther("1");
    await expect(
      dexManager.connect(addr1).swapExactETHForTokens(
        token1.target,
        fee,
        ethers.parseEther("0.5"), // minimum out
        { value: ethAmount }
      )
    ).to.emit(dexManager, "TokenSwapped");
  });
  
  it("Should swap exact tokens for ETH", async function () {
    await dexManager.connect(owner).authorizeToken(token0.target);
    
    // Transfer tokens to addr1
    await token0.transfer(addr1.address, ethers.parseEther("100"));
    await token0.connect(addr1).approve(dexManager.target, ethers.parseEther("10"));
    
    // Fund the swap router with ETH
    await owner.sendTransaction({ to: swapRouter.target, value: ethers.parseEther("10") });
    
    await expect(
      dexManager.connect(addr1).swapExactTokensForETH(
        token0.target,
        fee,
        ethers.parseEther("10"),
        ethers.parseEther("5") // minimum out
      )
    ).to.emit(dexManager, "TokenSwapped");
  });
  
  it("Should get token price", async function () {
    await dexManager.connect(owner).authorizeToken(token0.target);
    
    // Create a pool to initialize price
    await token0.approve(dexManager.target, amount0Desired);
    await token1.approve(dexManager.target, amount1Desired);
    await dexManager.createLiquidityPool(token0.target, token1.target, fee, amount0Desired, amount1Desired);
    
    const [price, lastUpdated] = await dexManager.getTokenPrice(token0.target);
    expect(price).to.be.gt(0);
    expect(lastUpdated).to.be.gt(0);
  });
  
  it("Should get token stats", async function () {
    await dexManager.connect(owner).authorizeToken(token0.target);
    
    // Create a pool to initialize stats
    await token0.approve(dexManager.target, amount0Desired);
    await token1.approve(dexManager.target, amount1Desired);
    await dexManager.createLiquidityPool(token0.target, token1.target, fee, amount0Desired, amount1Desired);
    
    const [price, marketCap, volume24h, liquidity, isActive] = await dexManager.getTokenStats(token0.target);
    expect(price).to.be.gt(0);
    expect(marketCap).to.be.gt(0);
    expect(liquidity).to.be.gt(0);
    expect(isActive).to.be.true;
  });

  it("Should fail to create pool with unauthorized token", async function () {
    await token0.approve(dexManager.target, amount0Desired);
    await token1.approve(dexManager.target, amount1Desired);

    await expect(
      dexManager.createLiquidityPool(
        token0.target,
        token1.target,
        fee,
        amount0Desired,
        amount1Desired
      )
    ).to.be.revertedWithCustomError(dexManager, "UnauthorizedToken");
  });

  it("Should fail to swap with unauthorized token", async function () {
    await expect(
      dexManager.connect(addr1).swapExactETHForTokens(
        token1.target,
        fee,
        ethers.parseEther("0.5"),
        { value: ethers.parseEther("1") }
      )
    ).to.be.revertedWithCustomError(dexManager, "UnauthorizedToken");
  });
});

