const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PumpFunDEXManager Integration Tests", function () {
  let dexManager;
  let swapRouter;
  let positionManager;
  let factory;
  let weth;
  let testToken;
  let owner, user1, user2;

  const FEE_TIER = 3000; // 0.3%

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy WETH mock
    const WETHMock = await ethers.getContractFactory("WETHMock");
    weth = await WETHMock.deploy();

    // Deploy a test token
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    testToken = await MockERC20.deploy("TestToken", "TEST", 0);
    
    // Mint initial supply to users
    await testToken.mint(user1.address, ethers.parseEther("1000000"));
    await testToken.mint(user2.address, ethers.parseEther("1000000"));

    // Deploy mock swap router with enhanced functionality
    const SwapRouterMock = await ethers.getContractFactory("SwapRouterMock");
    swapRouter = await SwapRouterMock.deploy(await weth.getAddress());

    // Deploy mock factory
    const MockFactory = await ethers.getContractFactory("MockFactory");
    factory = await MockFactory.deploy(ethers.ZeroAddress); // Use zero address for airdrop contract

    // Deploy mock position manager
    const NonfungiblePositionManagerMock = await ethers.getContractFactory("NonfungiblePositionManagerMock");
    positionManager = await NonfungiblePositionManagerMock.deploy(await factory.getAddress(), await weth.getAddress());

    // Deploy DEX Manager
    const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
    dexManager = await PumpFunDEXManager.deploy(
      await swapRouter.getAddress(),
      await positionManager.getAddress(),
      await factory.getAddress(),
      await weth.getAddress()
    );

    // Set up test environment
    await dexManager.authorizeToken(await testToken.getAddress());
    
    // Add some tokens to the swap router for realistic swapping
    await testToken.mint(await swapRouter.getAddress(), ethers.parseEther("10000000"));
    
    // Add some ETH to the swap router
    await owner.sendTransaction({
      to: await swapRouter.getAddress(),
      value: ethers.parseEther("1000")
    });
  });

  describe("Complete Trading Scenario", function () {
    it("Should complete a full buy-sell cycle", async function () {
      const ethAmount = ethers.parseEther("1");
      const minTokenAmount = ethers.parseEther("900"); // Expect at least 900 tokens for 1 ETH
      
      // Record initial balances
      const initialEthBalance = await ethers.provider.getBalance(user1.address);
      const initialTokenBalance = await testToken.balanceOf(user1.address);
      
      console.log("Initial ETH balance:", ethers.formatEther(initialEthBalance));
      console.log("Initial token balance:", ethers.formatEther(initialTokenBalance));

      // Step 1: Buy tokens with ETH (swapExactETHForTokens)
      console.log("\n=== BUYING TOKENS ===");
      const buyTx = await dexManager.connect(user1).swapExactETHForTokens(
        await testToken.getAddress(),
        FEE_TIER,
        minTokenAmount,
        { value: ethAmount }
      );
      
      await buyTx.wait();
      
      // Check balances after buying
      const afterBuyEthBalance = await ethers.provider.getBalance(user1.address);
      const afterBuyTokenBalance = await testToken.balanceOf(user1.address);
      
      console.log("After buy ETH balance:", ethers.formatEther(afterBuyEthBalance));
      console.log("After buy token balance:", ethers.formatEther(afterBuyTokenBalance));
      
      // Verify the purchase worked
      expect(afterBuyTokenBalance).to.be.greaterThan(initialTokenBalance);
      const tokensBought = afterBuyTokenBalance - initialTokenBalance;
      console.log("Tokens bought:", ethers.formatEther(tokensBought));

      // Step 2: Sell half the tokens for ETH (swapExactTokensForETH)
      console.log("\n=== SELLING TOKENS ===");
      const tokensToSell = tokensBought / 2n; // Sell half
      const minEthAmount = ethers.parseEther("0.4"); // Expect at least 0.4 ETH
      
      // First approve the DEX manager to spend tokens
      await testToken.connect(user1).approve(await dexManager.getAddress(), tokensToSell);
      
      const sellTx = await dexManager.connect(user1).swapExactTokensForETH(
        await testToken.getAddress(),
        FEE_TIER,
        tokensToSell,
        minEthAmount
      );
      
      await sellTx.wait();
      
      // Check final balances
      const finalEthBalance = await ethers.provider.getBalance(user1.address);
      const finalTokenBalance = await testToken.balanceOf(user1.address);
      
      console.log("Final ETH balance:", ethers.formatEther(finalEthBalance));
      console.log("Final token balance:", ethers.formatEther(finalTokenBalance));
      
      // Verify the sale worked
      expect(finalTokenBalance).to.be.lessThan(afterBuyTokenBalance);
      expect(finalEthBalance).to.be.greaterThan(afterBuyEthBalance);
      
      const tokensRemaining = finalTokenBalance - initialTokenBalance;
      console.log("Tokens remaining:", ethers.formatEther(tokensRemaining));
      
      // Should have approximately half the tokens left
      expect(tokensRemaining).to.be.approximately(tokensBought / 2n, ethers.parseEther("0.1"));
    });

    it("Should handle multiple users trading simultaneously", async function () {
      const ethAmount = ethers.parseEther("0.5");
      const minTokenAmount = ethers.parseEther("450");
      
      // Both users buy tokens
      await dexManager.connect(user1).swapExactETHForTokens(
        await testToken.getAddress(),
        FEE_TIER,
        minTokenAmount,
        { value: ethAmount }
      );
      
      await dexManager.connect(user2).swapExactETHForTokens(
        await testToken.getAddress(),
        FEE_TIER,
        minTokenAmount,
        { value: ethAmount }
      );
      
      // Check both users got tokens
      const user1TokenBalance = await testToken.balanceOf(user1.address);
      const user2TokenBalance = await testToken.balanceOf(user2.address);
      
      expect(user1TokenBalance).to.be.greaterThan(ethers.parseEther("1000000")); // More than initial
      expect(user2TokenBalance).to.be.greaterThan(ethers.parseEther("1000000")); // More than initial
      
      console.log("User1 token balance after buy:", ethers.formatEther(user1TokenBalance));
      console.log("User2 token balance after buy:", ethers.formatEther(user2TokenBalance));
    });

    it("Should reject trades with unauthorized tokens", async function () {
      // Deploy unauthorized token
      const MockERC20 = await ethers.getContractFactory("ERC20Mock");
      const unauthorizedToken = await MockERC20.deploy("Unauthorized", "UNAUTH", 0);
      
      await expect(
        dexManager.connect(user1).swapExactETHForTokens(
          await unauthorizedToken.getAddress(),
          FEE_TIER,
          ethers.parseEther("100"),
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__UnauthorizedToken");
    });

    it("Should reject trades with zero amounts", async function () {
      // Zero ETH for buying
      await expect(
        dexManager.connect(user1).swapExactETHForTokens(
          await testToken.getAddress(),
          FEE_TIER,
          ethers.parseEther("100"),
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidAmount");
      
      // Zero tokens for selling
      await expect(
        dexManager.connect(user1).swapExactTokensForETH(
          await testToken.getAddress(),
          FEE_TIER,
          0,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWithCustomError(dexManager, "PumpFunDEXManager__InvalidAmount");
    });

    it("Should update token price and volume after trades", async function () {
      const ethAmount = ethers.parseEther("2");
      
      // Get initial price info
      const [initialPrice, initialLastUpdated] = await dexManager.getTokenPrice(await testToken.getAddress());
      expect(initialPrice).to.equal(0); // Should be 0 initially
      
      // Make a trade
      await dexManager.connect(user1).swapExactETHForTokens(
        await testToken.getAddress(),
        FEE_TIER,
        ethers.parseEther("1800"),
        { value: ethAmount }
      );
      
      // Check that price was updated
      const [updatedPrice, updatedLastUpdated] = await dexManager.getTokenPrice(await testToken.getAddress());
      expect(updatedPrice).to.be.greaterThan(0);
      expect(updatedLastUpdated).to.be.greaterThan(initialLastUpdated);
      
      console.log("Updated price:", ethers.formatEther(updatedPrice));
      console.log("Price last updated:", updatedLastUpdated.toString());
    });
  });
});
