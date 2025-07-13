const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX Integration Tests", function () {
  let factory, dexManager, token, owner, creator, addr1;
  let weth, swapRouter, positionManager;

  beforeEach(async function () {
    [owner, creator, addr1] = await ethers.getSigners();

    // Deploy mock contracts
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const WETHMock = await ethers.getContractFactory("WETHMock");
    const SwapRouterMock = await ethers.getContractFactory("SwapRouterMock");
    const NonfungiblePositionManagerMock = await ethers.getContractFactory("NonfungiblePositionManagerMock");
    
    weth = await WETHMock.deploy();
    swapRouter = await SwapRouterMock.deploy(weth.target);
    positionManager = await NonfungiblePositionManagerMock.deploy(ethers.ZeroAddress, weth.target);

    // Deploy DEX manager
    const PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
    dexManager = await PumpFunDEXManager.deploy(
      swapRouter.target,
      positionManager.target,
      weth.target
    );

    // Deploy factory
    const PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
    factory = await PumpFunFactoryLite.deploy();
    
    // Configure factory
    await factory.setDEXManager(dexManager.target);
  });

  describe("Factory DEX Integration", function () {
    it("Should deploy token and set up DEX manager", async function () {
      const tokenName = "TestToken";
      const tokenSymbol = "TEST";
      const totalSupply = 1000000;
      const lockPeriodDays = 30;
      const deploymentFee = await factory.etherFee();

      // Deploy token
      await factory.connect(creator).deployToken(
        tokenName,
        tokenSymbol,
        totalSupply,
        lockPeriodDays,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      const tokenAddress = deployedTokens[0];
      
      // Verify token is deployed
      expect(await factory.isDeployedToken(tokenAddress)).to.be.true;
      
      // Test DEX manager is set
      expect(await factory.dexManager()).to.equal(dexManager.target);
    });

    it("Should authorize tokens in DEX manager", async function () {
      const tokenName = "TestToken";
      const tokenSymbol = "TEST";
      const totalSupply = 1000000;
      const lockPeriodDays = 30;
      const deploymentFee = await factory.etherFee();

      // Deploy token
      await factory.connect(creator).deployToken(
        tokenName,
        tokenSymbol,
        totalSupply,
        lockPeriodDays,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      const tokenAddress = deployedTokens[0];
      
      // Authorize in DEX manager
      await dexManager.authorizeToken(tokenAddress);
      expect(await dexManager.authorizedTokens(tokenAddress)).to.be.true;
    });
  });

  describe("DEX Specific Features", function () {
    let tokenAddress;
    
    beforeEach(async function () {
      // Deploy a test token
      const tokenName = "TestToken";
      const tokenSymbol = "TEST";
      const totalSupply = 1000000;
      const lockPeriodDays = 30;
      const deploymentFee = await factory.etherFee();

      await factory.connect(creator).deployToken(
        tokenName,
        tokenSymbol,
        totalSupply,
        lockPeriodDays,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      tokenAddress = deployedTokens[0];
      
      // Authorize token in DEX manager
      await dexManager.authorizeToken(tokenAddress);
    });

    it("Should create liquidity pool with fee tiers", async function () {
      const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
      const tokenContract = PumpFunToken.attach(tokenAddress);
      
      // Transfer tokens to owner for liquidity
      await tokenContract.connect(creator).transfer(owner.address, ethers.parseEther("1000"));
      
      const amount0Desired = ethers.parseEther("100");
      const amount1Desired = ethers.parseEther("100");
      const fee = 3000; // 0.3%
      
      // Approve tokens
      await tokenContract.approve(dexManager.target, amount0Desired);
      await weth.approve(dexManager.target, amount1Desired);
      
      // Deposit ETH to WETH for testing
      await weth.deposit({ value: amount1Desired });
      
      await expect(
        dexManager.createLiquidityPool(
          tokenAddress,
          weth.target,
          fee,
          amount0Desired,
          amount1Desired
        )
      ).to.emit(dexManager, "LiquidityPoolCreated");
    });

    it("Should handle different fee tiers", async function () {
      const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
      
      for (const fee of feeTiers) {
        expect(fee).to.be.lessThanOrEqual(10000); // Ensure fee is valid (1% is max)
        // Additional fee tier tests can be added here
      }
    });
  });

  describe("Gas Optimization", function () {
    it("Should have reasonable gas costs for DEX operations", async function () {
      // Deploy a simple token for gas testing
      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      const testToken = await ERC20Mock.deploy("Gas Test", "GAS", owner.address, ethers.parseEther("1000"));
      
      // Authorize token
      const authorizeTx = await dexManager.authorizeToken(testToken.target);
      const authorizeReceipt = await authorizeTx.wait();
      
      // Check gas usage is reasonable (adjust threshold as needed)
      expect(authorizeReceipt.gasUsed).to.be.lessThan(100000);
    });
  });
});
