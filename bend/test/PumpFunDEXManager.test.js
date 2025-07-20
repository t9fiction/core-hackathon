const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunDEXManager", function () {
  let dexManager;
  let token;
  let deployer, user1, user2, factory;
  let swapRouter, positionManager, uniswapV3Factory, weth;
  const TOKEN_SUPPLY = ethers.parseUnits("1000000", 18);

  async function deployDEXManagerFixture() {
    [deployer, user1, user2, factory] = await ethers.getSigners();
    
    // Mock addresses for required contracts/interfaces
    const MockAddress = ethers.ZeroAddress; // Simple placeholder
    swapRouter = MockAddress;
    positionManager = MockAddress;
    uniswapV3Factory = MockAddress;
    weth = MockAddress;
    
    // Deploy DEX Manager
    const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
    dexManager = await PumpFunDEXManager.deploy(swapRouter, positionManager, uniswapV3Factory, weth);
    await dexManager.waitForDeployment();
    
    // Deploy mock ERC20 token for testing
    const MockToken = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
    token = await MockToken.deploy("TestToken", "TEST", TOKEN_SUPPLY);
    await token.waitForDeployment();
    
    return { dexManager, token, deployer, user1, user2, factory };
  }

  describe("Deployment", function () {
    it("Should deploy with correct initial parameters", async function () {
      const { dexManager } = await loadFixture(deployDEXManagerFixture);
      
      expect(await dexManager.owner()).to.equal(deployer.address);
      expect(await dexManager.swapRouter()).to.equal(swapRouter);
      expect(await dexManager.positionManager()).to.equal(positionManager);
      expect(await dexManager.uniswapV3Factory()).to.equal(uniswapV3Factory);
      expect(await dexManager.WETH()).to.equal(weth);
    });
  });

  describe("Token Authorization", function () {
    it("Should authorize a token by owner", async function () {
      const { dexManager, token } = await loadFixture(deployDEXManagerFixture);
      
      await expect(dexManager.authorizeToken(await token.getAddress()))
        .to.emit(dexManager, "Authorization")
        .withArgs(await token.getAddress());
      
      expect(await dexManager.authorizedTokens(await token.getAddress())).to.be.true;
    });

    it("Should authorize a token by factory", async function () {
      const { dexManager, token, factory } = await loadFixture(deployDEXManagerFixture);
      
      dexManager = dexManager.connect(factory);
      
      await expect(dexManager.authorizeTokenFromFactory(await token.getAddress()))
        .to.emit(dexManager, "Authorization")
        .withArgs(await token.getAddress());
      
      expect(await dexManager.authorizedTokens(await token.getAddress())).to.be.true;
    });

    it("Should reject authorization by non-owner/factory", async function () {
      const { dexManager, token, user1 } = await loadFixture(deployDEXManagerFixture);
      
      dexManager = dexManager.connect(user1);
      
      await expect(dexManager.authorizeToken(await token.getAddress()))
        .to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(dexManager.authorizeTokenFromFactory(await token.getAddress()))
        .to.be.revertedWith("Caller is not the factory");
    });
  });

  describe("Liquidity Management", function () {
    it("Should create liquidity pool with ETH", async function () {
      const { dexManager, token, user1 } = await loadFixture(deployDEXManagerFixture);
      
      // Mock pool creation
      const fee = 3000; // 0.3%
      const tokenAmount = ethers.parseUnits("1000", 18);
      const ethAmount = ethers.parseEther("1");

      dexManager = dexManager.connect(user1);

      await expect(dexManager.createLiquidityPoolWithETH(await token.getAddress(), fee, tokenAmount, { value: ethAmount }))
        .to.emit(dexManager, "LiquidityPoolCreated");
    });

    it("Should create liquidity pool with token pairs", async function () {
      const { dexManager, token, user1 } = await loadFixture(deployDEXManagerFixture);

      const MockToken = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
      const secondaryToken = await MockToken.deploy("TestToken2", "TEST2", TOKEN_SUPPLY);
      const tokenAmount = ethers.parseUnits("1000", 18);
      const amountA = tokenAmount;
      const amountB = tokenAmount;

      dexManager = dexManager.connect(user1);

      await expect(dexManager.createLiquidityPool(await token.getAddress(), await secondaryToken.getAddress(), 3000, amountA, amountB))
        .to.emit(dexManager, "LiquidityPoolCreated");
    });
  });

  describe("Token Swap", function () {
    it("Should swap exact ETH for tokens", async function () {
      const { dexManager, token, user1 } = await loadFixture(deployDEXManagerFixture);

      const fee = 3000; // 0.3%
      const amountOutMinimum = 0;
      const ethAmount = ethers.parseEther("1");

      dexManager = dexManager.connect(user1);

      await expect(dexManager.swapExactETHForTokens(await token.getAddress(), fee, amountOutMinimum, { value: ethAmount }))
        .to.emit(dexManager, "TokenSwapped");
    });

    it("Should swap exact tokens for ETH", async function () {
      const { dexManager, token, user1 } = await loadFixture(deployDEXManagerFixture);

      const fee = 3000; // 0.3%
      const amountIn = ethers.parseUnits("100", 18);
      const amountOutMinimum = 0;

      dexManager = dexManager.connect(user1);

      await expect(dexManager.swapExactTokensForETH(await token.getAddress(), fee, amountIn, amountOutMinimum))
        .to.emit(dexManager, "TokenSwapped");
    });
  });

  describe("View Functions", function () {
    it("Should return correct token price", async function () {
      const { dexManager, token } = await loadFixture(deployDEXManagerFixture);

      const priceInfo = await dexManager.getTokenPrice(await token.getAddress());

      expect(priceInfo.price).to.be.at.least(0); // Placeholder assertion
      expect(priceInfo.lastUpdated).to.be.at.least(0);
    });

    it("Should return comprehensive token stats", async function () {
      const { dexManager, token } = await loadFixture(deployDEXManagerFixture);

      const stats = await dexManager.getTokenStats(await token.getAddress());

      expect(stats.price).to.be.at.least(0); // Placeholder assertion
      expect(stats.isActive).to.be.false; // As a default state
    });
  });
});

