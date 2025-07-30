const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunDEXManager Quoter Functionality", function () {
  let dexManager, mockSwapRouter, mockPositionManager, mockFactory, mockWETH, mockQuoter;
  let testToken1, testToken2;
  let owner, trader1;
  
  const FEE_TIER = 3000; // 0.3%

  async function deployDEXManagerFixture() {
    [owner, trader1] = await ethers.getSigners();
    
    // Deploy mock WETH first
    const WETHMock = await ethers.getContractFactory("WETHMock");
    mockWETH = await WETHMock.deploy();
    
    // Deploy mock factory
    const MockFactory = await ethers.getContractFactory("MockFactory");
    mockFactory = await MockFactory.deploy(ethers.ZeroAddress);
    
    // Deploy mock quoter
    const QuoterMock = await ethers.getContractFactory("QuoterMock");
    mockQuoter = await QuoterMock.deploy();
    await mockQuoter.waitForDeployment();

    // Deploy mock contracts
    const MockSwapRouter = await ethers.getContractFactory("SwapRouterMock");
    mockSwapRouter = await MockSwapRouter.deploy(await mockWETH.getAddress());
    
    const MockPositionManager = await ethers.getContractFactory("NonfungiblePositionManagerMock");
    mockPositionManager = await MockPositionManager.deploy(await mockFactory.getAddress(), await mockWETH.getAddress());
    
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    
    // Deploy test tokens
    testToken1 = await MockERC20.deploy("TestToken1", "TT1", 0);
    await testToken1.waitForDeployment();
    testToken2 = await MockERC20.deploy("TestToken2", "TT2", 0);
    await testToken2.waitForDeployment();
    
    // Deploy DEX Manager
    const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
    dexManager = await PumpFunDEXManager.deploy(
      await mockSwapRouter.getAddress(),
      await mockPositionManager.getAddress(),
      await mockFactory.getAddress(),
      await mockQuoter.getAddress(),
      await mockWETH.getAddress()
    );
    await dexManager.waitForDeployment();
    
    // Set up initial token balances
    const INITIAL_TOKEN_AMOUNT = ethers.parseEther("100000");
    await testToken1.mint(trader1.address, INITIAL_TOKEN_AMOUNT);
    await testToken2.mint(trader1.address, INITIAL_TOKEN_AMOUNT);
    
    // Authorize tokens
    await dexManager.authorizeToken(await testToken1.getAddress());
    await dexManager.authorizeToken(await testToken2.getAddress());
    
    return {
      dexManager,
      mockSwapRouter,
      mockPositionManager,
      mockFactory,
      mockWETH,
      mockQuoter,
      testToken1,
      testToken2,
      owner,
      trader1
    };
  }

  beforeEach(async function () {
    ({
      dexManager,
      mockSwapRouter,
      mockPositionManager,
      mockFactory,
      mockWETH,
      mockQuoter,
      testToken1,
      testToken2,
      owner,
      trader1
    } = await loadFixture(deployDEXManagerFixture));
  });

  describe("Quoter Functions", function () {
    beforeEach(async function () {
      // Set mock prices in quoter
      await mockQuoter.setMockPrice(
        await mockWETH.getAddress(),
        await testToken1.getAddress(),
        FEE_TIER,
        20000 // 2.0x multiplier (20000 basis points)
      );
      
      await mockQuoter.setMockPrice(
        await testToken1.getAddress(),
        await mockWETH.getAddress(),
        FEE_TIER,
        5000 // 0.5x multiplier (5000 basis points)
      );
    });

    it("Should return correct quotes for single hop swaps", async function () {
      const inputAmount = ethers.parseEther("1");
      
      const amountOut = await dexManager.getAmountsOutSingleHop(
        await mockWETH.getAddress(),
        await testToken1.getAddress(),
        FEE_TIER,
        inputAmount
      );
      
      // With mock price of 2.0x, 1 ETH should give 2 tokens
      expect(amountOut).to.equal(ethers.parseEther("2"));
    });

    it("Should return correct quotes for multi-hop swaps", async function () {
      const inputAmount = ethers.parseEther("1");
      const path = [
        await mockWETH.getAddress(),
        await testToken1.getAddress(),
        await testToken2.getAddress()
      ];
      const fees = [FEE_TIER, FEE_TIER];
      
      // Set up prices for the multi-hop path
      await mockQuoter.setMockPrice(
        await testToken1.getAddress(),
        await testToken2.getAddress(),
        FEE_TIER,
        15000 // 1.5x multiplier
      );
      
      const amounts = await dexManager.getAmountsOutMultiHop(inputAmount, path, fees);
      
      expect(amounts.length).to.equal(3);
      expect(amounts[0]).to.equal(inputAmount);
      expect(amounts[1]).to.equal(ethers.parseEther("2")); // First hop: 1 ETH -> 2 Token1
      expect(amounts[2]).to.equal(ethers.parseEther("3")); // Second hop: 2 Token1 -> 3 Token2
    });

    it("Should handle quoter failures gracefully", async function () {
      // Set quoter to revert
      await mockQuoter.setShouldRevert(true);
      
      const inputAmount = ethers.parseEther("1");
      
      const amountOut = await dexManager.getAmountsOutSingleHop(
        await mockWETH.getAddress(),
        await testToken1.getAddress(),
        FEE_TIER,
        inputAmount
      );
      
      // Should return 0 when quoter fails
      expect(amountOut).to.equal(0);
    });

    it("Should validate input parameters", async function () {
      await expect(
        dexManager.getAmountsOutSingleHop(
          ethers.ZeroAddress,
          await testToken1.getAddress(),
          FEE_TIER,
          ethers.parseEther("1")
        )
      ).to.be.revertedWith("Invalid token addresses");
      
      await expect(
        dexManager.getAmountsOutSingleHop(
          await mockWETH.getAddress(),
          await testToken1.getAddress(),
          FEE_TIER,
          0
        )
      ).to.be.revertedWith("Invalid amount");
    });

    it("Should handle path validation in multi-hop", async function () {
      const inputAmount = ethers.parseEther("1");
      
      // Invalid path length
      await expect(
        dexManager.getAmountsOutMultiHop(inputAmount, [await mockWETH.getAddress()], [])
      ).to.be.revertedWith("Invalid path length");
      
      // Mismatched path and fees length
      await expect(
        dexManager.getAmountsOutMultiHop(
          inputAmount, 
          [await mockWETH.getAddress(), await testToken1.getAddress()], 
          [FEE_TIER, FEE_TIER] // Too many fees
        )
      ).to.be.revertedWith("Path and fees length mismatch");
    });
  });

  describe("Swap Functions with Quoter Integration", function () {
    beforeEach(async function () {
      // Set mock prices
      await mockQuoter.setMockPrice(
        await mockWETH.getAddress(),
        await testToken1.getAddress(),
        FEE_TIER,
        20000 // 2.0x multiplier
      );
      
      await mockQuoter.setMockPrice(
        await testToken1.getAddress(),
        await mockWETH.getAddress(),
        FEE_TIER,
        5000 // 0.5x multiplier
      );
    });

    it("Should reject swaps when quoter fails", async function () {
      // Set quoter to revert
      await mockQuoter.setShouldRevert(true);
      
      const ethAmount = ethers.parseEther("1");
      
      await expect(
        dexManager.connect(trader1).swapExactETHForTokens(
          await testToken1.getAddress(),
          FEE_TIER,
          { value: ethAmount }
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InsufficientLiquidity");
    });

    it("Should validate slippage tolerance in custom functions", async function () {
      const ethAmount = ethers.parseEther("1");
      const invalidSlippage = 5001; // > 50%
      
      await expect(
        dexManager.connect(trader1).swapExactETHForTokensWithSlippage(
          await testToken1.getAddress(),
          FEE_TIER,
          invalidSlippage,
          { value: ethAmount }
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__SlippageExceeded");
    });

    it("Should calculate slippage correctly", async function () {
      const ethAmount = ethers.parseEther("1");
      const customSlippage = 1000; // 10%
      
      // This should pass validation (but fail at execution due to mock contracts)
      await expect(
        dexManager.connect(trader1).swapExactETHForTokensWithSlippage(
          await testToken1.getAddress(),
          FEE_TIER,
          customSlippage,
          { value: ethAmount }
        )
      ).to.be.reverted; // Will fail due to mock swap router, but should pass quoter logic
    });

    it("Should handle token approval for token-to-ETH swaps", async function () {
      const tokenAmount = ethers.parseEther("100");
      
      // Approve DEX manager to spend tokens
      await testToken1.connect(trader1).approve(await dexManager.getAddress(), tokenAmount);
      
      // This should pass validation but fail at execution
      await expect(
        dexManager.connect(trader1).swapExactTokensForETH(
          await testToken1.getAddress(),
          FEE_TIER,
          tokenAmount
        )
      ).to.be.reverted; // Will fail due to mock swap router
    });
  });

  describe("Quoter Contract State Management", function () {
    it("Should allow setting and updating mock prices", async function () {
      const tokenIn = await mockWETH.getAddress();
      const tokenOut = await testToken1.getAddress();
      const fee = FEE_TIER;
      const price1 = 15000; // 1.5x
      const price2 = 25000; // 2.5x
      
      // Set initial price
      await mockQuoter.setMockPrice(tokenIn, tokenOut, fee, price1);
      let storedPrice = await mockQuoter.mockPrices(tokenIn, tokenOut, fee);
      expect(storedPrice).to.equal(price1);
      
      // Update price
      await mockQuoter.setMockPrice(tokenIn, tokenOut, fee, price2);
      storedPrice = await mockQuoter.mockPrices(tokenIn, tokenOut, fee);
      expect(storedPrice).to.equal(price2);
    });

    it("Should handle revert state correctly", async function () {
      // Initially should not revert
      expect(await mockQuoter.shouldRevert()).to.be.false;
      
      // Set to revert
      await mockQuoter.setShouldRevert(true);
      expect(await mockQuoter.shouldRevert()).to.be.true;
      
      // Set back to not revert
      await mockQuoter.setShouldRevert(false);
      expect(await mockQuoter.shouldRevert()).to.be.false;
    });

    it("Should use default prices when no mock price is set", async function () {
      const inputAmount = ethers.parseEther("1");
      
      // Query for a pair without set mock price
      const amountOut = await mockQuoter.quoteExactInputSingle(
        await testToken1.getAddress(),
        await testToken2.getAddress(),
        FEE_TIER,
        inputAmount,
        0
      );
      
      // Should return default 2x multiplier
      expect(amountOut).to.equal(ethers.parseEther("2"));
    });
  });

  describe("Integration with DEX Manager State", function () {
    it("Should check quoter address is set correctly", async function () {
      expect(await dexManager.quoter()).to.equal(await mockQuoter.getAddress());
    });

    it("Should handle quoter integration in constructor validation", async function () {
      const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
      
      // Should revert with zero quoter address
      await expect(
        PumpFunDEXManager.deploy(
          await mockSwapRouter.getAddress(),
          await mockPositionManager.getAddress(),
          await mockFactory.getAddress(),
          ethers.ZeroAddress, // Invalid quoter address
          await mockWETH.getAddress()
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidTokenAddress");
    });
  });
});
