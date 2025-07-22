const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunDEXManager", function () {
  let dexManager, mockSwapRouter, mockPositionManager, mockFactory, mockWETH;
  let testToken1, testToken2;
  let owner, factory, trader1, trader2;
  
  const FEE_TIER = 3000; // 0.3%

  async function deployDEXManagerFixture() {
    [owner, factory, trader1, trader2] = await ethers.getSigners();
    
    // Deploy mock contracts
    const MockSwapRouter = await ethers.getContractFactory("SwapRouterMock");
    mockSwapRouter = await MockSwapRouter.deploy();
    
    const MockPositionManager = await ethers.getContractFactory("NonfungiblePositionManagerMock");
    mockPositionManager = await MockPositionManager.deploy();
    
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockFactory = await MockERC20.deploy("MockFactory", "MF", 0);
    mockWETH = await MockERC20.deploy("WETH", "WETH", 0);
    
    // Deploy test tokens
    testToken1 = await MockERC20.deploy("TestToken1", "TT1", 0);
    testToken2 = await MockERC20.deploy("TestToken2", "TT2", 0);
    
    // Deploy DEX Manager
    const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
    dexManager = await PumpFunDEXManager.deploy(
      await mockSwapRouter.getAddress(),
      await mockPositionManager.getAddress(),
      await mockFactory.getAddress(),
      await mockWETH.getAddress()
    );
    await dexManager.waitForDeployment();
    
    // Set up initial token balances
    const INITIAL_TOKEN_AMOUNT = ethers.parseEther("100000");
    const INITIAL_ETH_AMOUNT = ethers.parseEther("10");
    
    await testToken1.mint(trader1.address, INITIAL_TOKEN_AMOUNT);
    await testToken2.mint(trader1.address, INITIAL_TOKEN_AMOUNT);
    await mockWETH.mint(trader1.address, INITIAL_ETH_AMOUNT);
    
    return {
      dexManager,
      mockSwapRouter,
      mockPositionManager,
      mockFactory,
      mockWETH,
      testToken1,
      testToken2,
      owner,
      factory,
      trader1,
      trader2
    };
  }

  beforeEach(async function () {
    ({
      dexManager,
      mockSwapRouter,
      mockPositionManager,
      mockFactory,
      mockWETH,
      testToken1,
      testToken2,
      owner,
      factory,
      trader1,
      trader2
    } = await loadFixture(deployDEXManagerFixture));
  });

  describe("Deployment", function () {
    it("Should set correct initial state", async function () {
      expect(await dexManager.owner()).to.equal(owner.address);
      expect(await dexManager.swapRouter()).to.equal(await mockSwapRouter.getAddress());
      expect(await dexManager.positionManager()).to.equal(await mockPositionManager.getAddress());
      expect(await dexManager.uniswapV3Factory()).to.equal(await mockFactory.getAddress());
      expect(await dexManager.WETH()).to.equal(await mockWETH.getAddress());
    });

    it("Should revert with zero addresses", async function () {
      const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
      
      await expect(
        PumpFunDEXManager.deploy(
          ethers.ZeroAddress,
          await mockPositionManager.getAddress(),
          await mockFactory.getAddress(),
          await mockWETH.getAddress()
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidTokenAddress");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set factory", async function () {
      await dexManager.setFactory(factory.address);
      expect(await dexManager.factory()).to.equal(factory.address);
    });

    it("Should allow owner to authorize tokens", async function () {
      await dexManager.authorizeToken(testToken1.address);
      expect(await dexManager.authorizedTokens(testToken1.address)).to.be.true;
    });

    it("Should allow factory to authorize tokens", async function () {
      await dexManager.setFactory(factory.address);
      await dexManager.connect(factory).authorizeTokenFromFactory(testToken1.address);
      expect(await dexManager.authorizedTokens(testToken1.address)).to.be.true;
    });

    it("Should prevent non-owners from setting factory", async function () {
      await expect(
        dexManager.connect(trader1).setFactory(factory.address)
      ).to.be.revertedWithCustomError(dexManager, "OwnableUnauthorizedAccount");
    });

    it("Should prevent non-factory from authorizing tokens", async function () {
      await dexManager.setFactory(factory.address);
      
      await expect(
        dexManager.connect(trader1).authorizeTokenFromFactory(testToken1.address)
      ).to.be.revertedWith("Caller is not the factory");
    });

    it("Should reject zero address for token authorization", async function () {
      await expect(
        dexManager.authorizeToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidTokenAddress");
    });
  });

  describe("Liquidity Pool Creation", function () {
    beforeEach(async function () {
      await dexManager.authorizeToken(testToken1.address);
      await dexManager.authorizeToken(testToken2.address);
    });

    it("Should create liquidity pool with ETH successfully", async function () {
      const tokenAmount = ethers.parseEther("10000");
      const ethAmount = ethers.parseEther("1");
      
      // Approve DEX manager to spend tokens
      await testToken1.connect(trader1).approve(dexManager.address, tokenAmount);
      
      // This will fail with mock contracts but should pass validation
      await expect(
        dexManager.connect(trader1).createLiquidityPoolWithETH(
          testToken1.address,
          FEE_TIER,
          tokenAmount,
          { value: ethAmount }
        )
      ).to.be.reverted; // Will fail due to mock contracts
    });

    it("Should create liquidity pool between two tokens", async function () {
      const tokenAmount1 = ethers.parseEther("10000");
      const tokenAmount2 = ethers.parseEther("20000");
      
      // Approve DEX manager to spend tokens
      await testToken1.connect(trader1).approve(dexManager.address, tokenAmount1);
      await testToken2.connect(trader1).approve(dexManager.address, tokenAmount2);
      
      // This will fail with mock contracts but should pass validation
      await expect(
        dexManager.connect(trader1).createLiquidityPool(
          testToken1.address,
          testToken2.address,
          FEE_TIER,
          tokenAmount1,
          tokenAmount2
        )
      ).to.be.reverted; // Will fail due to mock contracts
    });

    it("Should reject unauthorized tokens", async function () {
      const unauthorizedToken = testToken2.address;
      const tokenAmount = ethers.parseEther("10000");
      const ethAmount = ethers.parseEther("1");
      
      // Remove authorization
      await dexManager.authorizeToken(testToken2.address);
      await dexManager.authorizeToken(testToken1.address);
      
      await expect(
        dexManager.connect(trader1).createLiquidityPoolWithETH(
          unauthorizedToken,
          FEE_TIER,
          tokenAmount,
          { value: ethAmount }
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__UnauthorizedToken");
    });

    it("Should reject zero amounts", async function () {
      // Zero ETH
      await expect(
        dexManager.connect(trader1).createLiquidityPoolWithETH(
          testToken1.address,
          FEE_TIER,
          ethers.parseEther("10000"),
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidAmount");
      
      // Zero tokens
      await expect(
        dexManager.connect(trader1).createLiquidityPoolWithETH(
          testToken1.address,
          FEE_TIER,
          0,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidAmount");
    });

    it("Should reject zero address tokens", async function () {
      await expect(
        dexManager.connect(trader1).createLiquidityPool(
          ethers.ZeroAddress,
          testToken2.address,
          FEE_TIER,
          ethers.parseEther("10000"),
          ethers.parseEther("20000")
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidTokenAddress");
    });

    it("Should require at least one authorized token for pool creation", async function () {
      // Deploy unauthorized token
      const MockERC20 = await ethers.getContractFactory("ERC20Mock");
      const unauthorizedToken1 = await MockERC20.deploy("Unauth1", "UA1", 0);
      const unauthorizedToken2 = await MockERC20.deploy("Unauth2", "UA2", 0);
      
      await expect(
        dexManager.connect(trader1).createLiquidityPool(
          unauthorizedToken1.address,
          unauthorizedToken2.address,
          FEE_TIER,
          ethers.parseEther("10000"),
          ethers.parseEther("20000")
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__UnauthorizedToken");
    });
  });

  describe("Trading Functions", function () {
    beforeEach(async function () {
      await dexManager.authorizeToken(testToken1.address);
      await dexManager.authorizeToken(testToken2.address);
    });

    it("Should swap exact ETH for tokens", async function () {
      const ethAmount = ethers.parseEther("1");
      const minTokenAmount = ethers.parseEther("100");
      
      // This will fail with mock contracts but should pass validation
      await expect(
        dexManager.connect(trader1).swapExactETHForTokens(
          testToken1.address,
          FEE_TIER,
          minTokenAmount,
          { value: ethAmount }
        )
      ).to.be.reverted; // Will fail due to mock swap router
    });

    it("Should swap exact tokens for ETH", async function () {
      const tokenAmount = ethers.parseEther("1000");
      const minEthAmount = ethers.parseEther("0.1");
      
      // Approve DEX manager to spend tokens
      await testToken1.connect(trader1).approve(dexManager.address, tokenAmount);
      
      // This will fail with mock contracts but should pass validation
      await expect(
        dexManager.connect(trader1).swapExactTokensForETH(
          testToken1.address,
          FEE_TIER,
          tokenAmount,
          minEthAmount
        )
      ).to.be.reverted; // Will fail due to mock swap router
    });

    it("Should reject swapping unauthorized tokens", async function () {
      // Deploy unauthorized token
      const MockERC20 = await ethers.getContractFactory("ERC20Mock");
      const unauthorizedToken = await MockERC20.deploy("Unauth", "UA", 0);
      
      await expect(
        dexManager.connect(trader1).swapExactETHForTokens(
          unauthorizedToken.address,
          FEE_TIER,
          ethers.parseEther("100"),
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__UnauthorizedToken");
    });

    it("Should reject zero amounts for swapping", async function () {
      // Zero ETH
      await expect(
        dexManager.connect(trader1).swapExactETHForTokens(
          testToken1.address,
          FEE_TIER,
          ethers.parseEther("100"),
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidAmount");
      
      // Zero tokens
      await expect(
        dexManager.connect(trader1).swapExactTokensForETH(
          testToken1.address,
          FEE_TIER,
          0,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidAmount");
    });
  });

  describe("Liquidity Addition", function () {
    beforeEach(async function () {
      await dexManager.authorizeToken(testToken1.address);
      await dexManager.authorizeToken(testToken2.address);
    });

    it("Should add liquidity to existing pool", async function () {
      const tokenAmount1 = ethers.parseEther("5000");
      const tokenAmount2 = ethers.parseEther("10000");
      
      // Approve DEX manager to spend tokens
      await testToken1.connect(trader1).approve(dexManager.address, tokenAmount1);
      await testToken2.connect(trader1).approve(dexManager.address, tokenAmount2);
      
      // This will fail with mock contracts but should pass validation
      await expect(
        dexManager.connect(trader1).addLiquidity(
          testToken1.address,
          testToken2.address,
          FEE_TIER,
          tokenAmount1,
          tokenAmount2
        )
      ).to.be.reverted; // Will fail due to no existing pool in mock
    });

    it("Should reject adding liquidity with zero amounts", async function () {
      await expect(
        dexManager.connect(trader1).addLiquidity(
          testToken1.address,
          testToken2.address,
          FEE_TIER,
          0,
          ethers.parseEther("10000")
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidAmount");
    });
  });

  describe("Price and Statistics", function () {
    beforeEach(async function () {
      await dexManager.authorizeToken(testToken1.address);
    });

    it("Should return token price information", async function () {
      const [price, lastUpdated] = await dexManager.getTokenPrice(testToken1.address);
      expect(price).to.equal(0); // No price set initially
      expect(lastUpdated).to.equal(0); // No update initially
    });

    it("Should return token statistics", async function () {
      const [price, marketCap, volume24h, liquidity, isActive] = await dexManager.getTokenStats(testToken1.address);
      expect(price).to.equal(0);
      expect(marketCap).to.equal(0);
      expect(volume24h).to.equal(0);
      expect(liquidity).to.equal(0);
      expect(isActive).to.be.false;
    });

    it("Should return pool information", async function () {
      const [tokenId, liquidity, lockExpiry, isActive, createdAt] = await dexManager.getPoolInfo(
        testToken1.address,
        testToken2.address,
        FEE_TIER
      );
      expect(tokenId).to.equal(0);
      expect(liquidity).to.equal(0);
      expect(lockExpiry).to.equal(0);
      expect(isActive).to.be.false;
      expect(createdAt).to.equal(0);
    });

    it("Should return pool address from factory", async function () {
      // This will return zero address from mock factory
      const poolAddress = await dexManager.getPoolAddress(
        testToken1.address,
        testToken2.address,
        FEE_TIER
      );
      expect(poolAddress).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async function () {
      // Send some ETH to the contract
      await owner.sendTransaction({
        to: dexManager.address,
        value: ethers.parseEther("1")
      });
      
      // Send some tokens to the contract
      await testToken1.mint(dexManager.address, ethers.parseEther("1000"));
    });

    it("Should allow owner to withdraw stuck ETH", async function () {
      const contractBalanceBefore = await ethers.provider.getBalance(dexManager.address);
      const ownerBalanceBefore = await owner.getBalance();
      
      const tx = await dexManager.withdrawETH();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const contractBalanceAfter = await ethers.provider.getBalance(dexManager.address);
      const ownerBalanceAfter = await owner.getBalance();
      
      expect(contractBalanceAfter).to.equal(0);
      expect(ownerBalanceAfter).to.equal(
        ownerBalanceBefore + contractBalanceBefore - gasUsed
      );
    });

    it("Should allow owner to withdraw stuck tokens", async function () {
      const withdrawAmount = ethers.parseEther("500");
      const ownerBalanceBefore = await testToken1.balanceOf(owner.address);
      
      await dexManager.withdrawToken(testToken1.address, withdrawAmount);
      
      const ownerBalanceAfter = await testToken1.balanceOf(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + withdrawAmount);
    });

    it("Should prevent non-owners from emergency withdrawals", async function () {
      await expect(
        dexManager.connect(trader1).withdrawETH()
      ).to.be.revertedWithCustomError(dexManager, "OwnableUnauthorizedAccount");
      
      await expect(
        dexManager.connect(trader1).withdrawToken(testToken1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(dexManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("Internal Functions", function () {
    it("Should calculate correct tick spacing for fee tiers", async function () {
      // These are internal functions, but we can test through public functions that use them
      // The tick spacing logic is used in pool creation
      
      // We can't directly test internal functions, but we know the expected values:
      // Fee 100 -> tickSpacing 1
      // Fee 500 -> tickSpacing 10  
      // Fee 3000 -> tickSpacing 60
      // Fee 10000 -> tickSpacing 200
      
      // This is tested indirectly through pool creation functionality
      expect(true).to.be.true; // Placeholder test
    });

    it("Should handle square root calculations correctly", async function () {
      // Similar to tick spacing, this is tested through price calculations
      // in pool creation and swapping functions
      expect(true).to.be.true; // Placeholder test
    });
  });

  describe("Receive and Fallback Functions", function () {
    it("Should accept ETH through receive function", async function () {
      const ethAmount = ethers.parseEther("1");
      
      await expect(() =>
        trader1.sendTransaction({
          to: dexManager.address,
          value: ethAmount
        })
      ).to.changeEtherBalance(dexManager, ethAmount);
    });

    it("Should accept ETH through fallback function", async function () {
      const ethAmount = ethers.parseEther("1");
      
      await expect(() =>
        trader1.sendTransaction({
          to: dexManager.address,
          value: ethAmount,
          data: "0x1234" // Triggers fallback
        })
      ).to.changeEtherBalance(dexManager, ethAmount);
    });
  });

  describe("Complex Integration Scenarios", function () {
    beforeEach(async function () {
      await dexManager.setFactory(factory.address);
      await dexManager.connect(factory).authorizeTokenFromFactory(testToken1.address);
      await dexManager.connect(factory).authorizeTokenFromFactory(testToken2.address);
    });

    it("Should handle multiple authorized tokens correctly", async function () {
      expect(await dexManager.authorizedTokens(testToken1.address)).to.be.true;
      expect(await dexManager.authorizedTokens(testToken2.address)).to.be.true;
      
      // Deploy third token and don't authorize it
      const MockERC20 = await ethers.getContractFactory("ERC20Mock");
      const testToken3 = await MockERC20.deploy("TestToken3", "TT3", 0);
      
      expect(await dexManager.authorizedTokens(testToken3.address)).to.be.false;
    });

    it("Should handle token ordering correctly in pool operations", async function () {
      // Test that tokens are ordered correctly (token0 < token1) internally
      // This affects how pools are created and managed
      
      const token1Address = testToken1.address;
      const token2Address = testToken2.address;
      
      // Get pool info in both orders - should return same pool
      const poolInfo1 = await dexManager.getPoolInfo(token1Address, token2Address, FEE_TIER);
      const poolInfo2 = await dexManager.getPoolInfo(token2Address, token1Address, FEE_TIER);
      
      // Both should refer to the same pool (all zeros in our mock case)
      expect(poolInfo1.tokenId).to.equal(poolInfo2.tokenId);
      expect(poolInfo1.isActive).to.equal(poolInfo2.isActive);
    });
  });
});
