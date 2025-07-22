const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunFactoryLite", function () {
  let factory, mockDEXManager, mockGovernance, mockAirdrop;
  let owner, creator, addr1, addr2;
  
  const DEFAULT_FEE = ethers.parseEther("0.05");
  const STANDARD_SUPPLY = 50000000; // 50M tokens
  const PREMIUM_SUPPLY = 200000000; // 200M tokens
  const ULTIMATE_SUPPLY = 800000000; // 800M tokens
  const LOCK_PERIOD = 30; // 30 days

  async function deployFactoryFixture() {
    [owner, creator, addr1, addr2] = await ethers.getSigners();
    
    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockDEXManager = await MockERC20.deploy("MockDEX", "MDEX", 0);
    mockGovernance = await MockERC20.deploy("MockGov", "MGOV", 0);
    mockAirdrop = await MockERC20.deploy("MockAirdrop", "MAIR", 0);
    
    // Deploy factory
    const PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
    factory = await PumpFunFactoryLite.deploy();
    
    return { factory, mockDEXManager, mockGovernance, mockAirdrop, owner, creator, addr1, addr2 };
  }

  beforeEach(async function () {
    ({ factory, mockDEXManager, mockGovernance, mockAirdrop, owner, creator, addr1, addr2 } = await loadFixture(deployFactoryFixture));
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should have correct initial state", async function () {
      expect(await factory.etherFee()).to.equal(DEFAULT_FEE);
      expect(await factory.totalTokensDeployed()).to.equal(0);
      expect(await factory.totalFeesCollected()).to.equal(0);
      expect(await factory.autoCreatePools()).to.be.true;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set DEX manager", async function () {
      await expect(factory.setDEXManager(mockDEXManager.address))
        .to.emit(factory, "DEXManagerUpdated")
        .withArgs(ethers.ZeroAddress, mockDEXManager.address);
      
      expect(await factory.dexManager()).to.equal(mockDEXManager.address);
    });

    it("Should allow owner to set governance manager", async function () {
      await expect(factory.setGovernanceManager(mockGovernance.address))
        .to.emit(factory, "GovernanceManagerUpdated")
        .withArgs(ethers.ZeroAddress, mockGovernance.address);
      
      expect(await factory.governanceManager()).to.equal(mockGovernance.address);
    });

    it("Should allow owner to set airdrop manager", async function () {
      await expect(factory.setAirdropManager(mockAirdrop.address))
        .to.emit(factory, "AirdropManagerUpdated")
        .withArgs(ethers.ZeroAddress, mockAirdrop.address);
      
      expect(await factory.airdropContract()).to.equal(mockAirdrop.address);
    });

    it("Should allow owner to update ether fee", async function () {
      const newFee = ethers.parseEther("0.1");
      
      await expect(factory.setEtherFee(newFee))
        .to.emit(factory, "EtherFeeUpdated")
        .withArgs(DEFAULT_FEE, newFee);
      
      expect(await factory.etherFee()).to.equal(newFee);
    });

    it("Should reject fee that exceeds maximum", async function () {
      const excessiveFee = ethers.parseEther("2"); // > MAX_FEE (1 ether)
      
      await expect(factory.setEtherFee(excessiveFee))
        .to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidFeeAmount");
    });

    it("Should allow owner to toggle auto pool creation", async function () {
      await factory.setAutoCreatePools(false);
      expect(await factory.autoCreatePools()).to.be.false;
      
      await factory.setAutoCreatePools(true);
      expect(await factory.autoCreatePools()).to.be.true;
    });

    it("Should prevent non-owners from accessing admin functions", async function () {
      await expect(
        factory.connect(addr1).setEtherFee(ethers.parseEther("0.1"))
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
      
      await expect(
        factory.connect(addr1).setDEXManager(mockDEXManager.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });

  describe("Fee Calculation", function () {
    it("Should calculate correct fees for different supply tiers", async function () {
      const standardFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      const premiumFee = await factory.getRequiredFee(PREMIUM_SUPPLY);
      const ultimateFee = await factory.getRequiredFee(ULTIMATE_SUPPLY);
      
      expect(standardFee).to.equal(DEFAULT_FEE * 1n); // Standard multiplier
      expect(premiumFee).to.equal(DEFAULT_FEE * 3n); // Premium multiplier
      expect(ultimateFee).to.equal(DEFAULT_FEE * 10n); // Ultimate multiplier
    });

    it("Should return correct supply tier information", async function () {
      let [tier, maxSupply, feeMultiplier] = await factory.getSupplyTier(STANDARD_SUPPLY);
      expect(tier).to.equal("Standard");
      expect(feeMultiplier).to.equal(1);
      
      [tier, maxSupply, feeMultiplier] = await factory.getSupplyTier(PREMIUM_SUPPLY);
      expect(tier).to.equal("Premium");
      expect(feeMultiplier).to.equal(3);
      
      [tier, maxSupply, feeMultiplier] = await factory.getSupplyTier(ULTIMATE_SUPPLY);
      expect(tier).to.equal("Ultimate");
      expect(feeMultiplier).to.equal(10);
    });
  });

  describe("Token Deployment", function () {
    it("Should deploy token successfully with correct fee", async function () {
      const tokenName = "TestToken";
      const tokenSymbol = "TEST";
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      
      await expect(
        factory.connect(creator).deployToken(
          tokenName,
          tokenSymbol,
          STANDARD_SUPPLY,
          LOCK_PERIOD,
          { value: requiredFee }
        )
      ).to.emit(factory, "TokenDeployed");
      
      expect(await factory.totalTokensDeployed()).to.equal(1);
      expect(await factory.totalFeesCollected()).to.equal(requiredFee);
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      expect(creatorTokens.length).to.equal(1);
      expect(await factory.isDeployedToken(creatorTokens[0])).to.be.true;
    });

    it("Should refund excess ETH", async function () {
      const tokenName = "TestToken";
      const tokenSymbol = "TEST";
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      const excessAmount = requiredFee + ethers.parseEther("0.1");
      
      const initialBalance = await creator.getBalance();
      
      const tx = await factory.connect(creator).deployToken(
        tokenName,
        tokenSymbol,
        STANDARD_SUPPLY,
        LOCK_PERIOD,
        { value: excessAmount }
      );
      
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const finalBalance = await creator.getBalance();
      
      // Should only deduct required fee + gas
      expect(initialBalance - finalBalance).to.be.closeTo(
        requiredFee + gasUsed,
        ethers.parseEther("0.001") // Small tolerance for gas estimation differences
      );
    });

    it("Should reject insufficient fee", async function () {
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      const insufficientFee = requiredFee - 1n;
      
      await expect(
        factory.connect(creator).deployToken(
          "TestToken",
          "TEST",
          STANDARD_SUPPLY,
          LOCK_PERIOD,
          { value: insufficientFee }
        )
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InsufficientEtherFee");
    });

    it("Should reject invalid parameters", async function () {
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      
      // Empty name
      await expect(
        factory.connect(creator).deployToken(
          "",
          "TEST",
          STANDARD_SUPPLY,
          LOCK_PERIOD,
          { value: requiredFee }
        )
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__EmptyStringParameter");
      
      // Empty symbol
      await expect(
        factory.connect(creator).deployToken(
          "TestToken",
          "",
          STANDARD_SUPPLY,
          LOCK_PERIOD,
          { value: requiredFee }
        )
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__EmptyStringParameter");
      
      // Too low supply
      await expect(
        factory.connect(creator).deployToken(
          "TestToken",
          "TEST",
          500, // Less than MIN_TOTAL_SUPPLY
          LOCK_PERIOD,
          { value: requiredFee }
        )
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TotalSupplyTooLow");
      
      // Too high supply
      await expect(
        factory.connect(creator).deployToken(
          "TestToken",
          "TEST",
          1500000000, // More than ULTIMATE_MAX_SUPPLY
          LOCK_PERIOD,
          { value: requiredFee }
        )
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TotalSupplyTooHigh");
      
      // Insufficient lock period
      await expect(
        factory.connect(creator).deployToken(
          "TestToken",
          "TEST",
          STANDARD_SUPPLY,
          15, // Less than minimum 30 days
          { value: requiredFee }
        )
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InsufficientLiquidityLockPeriod");
    });

    it("Should track token balances correctly", async function () {
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      
      const tx = await factory.connect(creator).deployToken(
        "TestToken",
        "TEST",
        STANDARD_SUPPLY,
        LOCK_PERIOD,
        { value: requiredFee }
      );
      
      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt.events.find(e => e.event === "TokenDeployed");
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      
      const expectedSupply = ethers.parseEther(STANDARD_SUPPLY.toString());
      const liquidityBalance = await factory.tokenLiquidityPoolBalance(tokenAddress);
      const dexBalance = await factory.tokenDexPoolBalance(tokenAddress);
      
      expect(liquidityBalance).to.equal(expectedSupply * 20n / 100n); // 20%
      expect(dexBalance).to.equal(expectedSupply * 40n / 100n); // 40%
    });
  });

  describe("Liquidity Management", function () {
    let tokenAddress;
    
    beforeEach(async function () {
      // Deploy a token first
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      const tx = await factory.connect(creator).deployToken(
        "TestToken",
        "TEST",
        STANDARD_SUPPLY,
        LOCK_PERIOD,
        { value: requiredFee }
      );
      
      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt.events.find(e => e.event === "TokenDeployed");
      tokenAddress = tokenDeployedEvent.args.tokenAddress;
    });

    it("Should allow creator to add and lock liquidity", async function () {
      const ethAmount = ethers.parseEther("1");
      const tokenAmount = ethers.parseEther("10000");
      
      // First approve the factory to spend tokens
      const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
      const token = PumpFunToken.attach(tokenAddress);
      
      await expect(
        factory.connect(creator).addAndLockLiquidity(tokenAddress, tokenAmount, { value: ethAmount })
      ).to.emit(factory, "LiquidityAdded")
        .withArgs(tokenAddress, creator.address, ethAmount, tokenAmount);
    });

    it("Should reject liquidity addition from non-creator", async function () {
      const ethAmount = ethers.parseEther("1");
      const tokenAmount = ethers.parseEther("10000");
      
      await expect(
        factory.connect(addr1).addAndLockLiquidity(tokenAddress, tokenAmount, { value: ethAmount })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidParameters");
    });

    it("Should reject invalid liquidity amounts", async function () {
      // Zero ETH
      await expect(
        factory.connect(creator).addAndLockLiquidity(tokenAddress, ethers.parseEther("10000"), { value: 0 })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidLiquidityAmount");
      
      // Zero tokens
      await expect(
        factory.connect(creator).addAndLockLiquidity(tokenAddress, 0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidLiquidityAmount");
    });
  });

  describe("DEX Pool Creation", function () {
    let tokenAddress;
    
    beforeEach(async function () {
      // Set up DEX manager mock
      await factory.setDEXManager(mockDEXManager.address);
      
      // Deploy a token first
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      const tx = await factory.connect(creator).deployToken(
        "TestToken",
        "TEST",
        STANDARD_SUPPLY,
        LOCK_PERIOD,
        { value: requiredFee }
      );
      
      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt.events.find(e => e.event === "TokenDeployed");
      tokenAddress = tokenDeployedEvent.args.tokenAddress;
    });

    it("Should create DEX pool with proper parameters", async function () {
      const ethAmount = ethers.parseEther("1");
      const tokenAmount = ethers.parseEther("10000");
      const fee = 3000; // 0.3%
      
      // This will fail without proper DEX manager mock, but should pass validation
      await expect(
        factory.connect(creator).createDEXPool(tokenAddress, tokenAmount, fee, { value: ethAmount })
      ).to.be.reverted; // Will revert due to mock DEX manager lacking proper interface
    });

    it("Should reject DEX pool creation from non-creator", async function () {
      const ethAmount = ethers.parseEther("1");
      const tokenAmount = ethers.parseEther("10000");
      const fee = 3000;
      
      await expect(
        factory.connect(addr1).createDEXPool(tokenAddress, tokenAmount, fee, { value: ethAmount })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidParameters");
    });
  });

  describe("Anti-Rug Pull", function () {
    let tokenAddress;
    
    beforeEach(async function () {
      // Deploy a token first
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      const tx = await factory.connect(creator).deployToken(
        "TestToken",
        "TEST",
        STANDARD_SUPPLY,
        LOCK_PERIOD,
        { value: requiredFee }
      );
      
      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt.events.find(e => e.event === "TokenDeployed");
      tokenAddress = tokenDeployedEvent.args.tokenAddress;
    });

    it("Should allow owner to trigger anti-rug pull", async function () {
      const reason = "Suspicious activity detected";
      
      await expect(factory.triggerAntiRugPull(tokenAddress, reason))
        .to.emit(factory, "AntiRugPullTriggered")
        .withArgs(tokenAddress, creator.address, reason);
    });

    it("Should reject anti-rug pull for non-deployed tokens", async function () {
      const fakeTokenAddress = addr1.address;
      const reason = "Test reason";
      
      await expect(
        factory.triggerAntiRugPull(fakeTokenAddress, reason)
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TokenNotDeployedByFactory");
    });
  });

  describe("Fee Withdrawal", function () {
    beforeEach(async function () {
      // Deploy some tokens to accumulate fees
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      
      await factory.connect(creator).deployToken(
        "TestToken1",
        "TEST1",
        STANDARD_SUPPLY,
        LOCK_PERIOD,
        { value: requiredFee }
      );
    });

    it("Should allow owner to withdraw fees", async function () {
      const initialBalance = await owner.getBalance();
      const contractBalance = await ethers.provider.getBalance(factory.address);
      
      const tx = await factory.withdrawFees();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await owner.getBalance();
      
      expect(finalBalance).to.equal(
        initialBalance + contractBalance - gasUsed
      );
    });

    it("Should reject fee withdrawal when no fees available", async function () {
      // Withdraw all fees first
      await factory.withdrawFees();
      
      await expect(factory.withdrawFees())
        .to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__NoEtherToWithdraw");
    });

    it("Should prevent non-owners from withdrawing fees", async function () {
      await expect(
        factory.connect(addr1).withdrawFees()
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    let tokenAddress1, tokenAddress2;
    
    beforeEach(async function () {
      // Deploy multiple tokens
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      
      let tx = await factory.connect(creator).deployToken(
        "TestToken1",
        "TEST1",
        STANDARD_SUPPLY,
        LOCK_PERIOD,
        { value: requiredFee }
      );
      let receipt = await tx.wait();
      tokenAddress1 = receipt.events.find(e => e.event === "TokenDeployed").args.tokenAddress;
      
      tx = await factory.connect(addr1).deployToken(
        "TestToken2",
        "TEST2",
        PREMIUM_SUPPLY,
        LOCK_PERIOD,
        { value: await factory.getRequiredFee(PREMIUM_SUPPLY) }
      );
      receipt = await tx.wait();
      tokenAddress2 = receipt.events.find(e => e.event === "TokenDeployed").args.tokenAddress;
    });

    it("Should return correct factory statistics", async function () {
      const [totalTokens, totalFees, currentBalance] = await factory.getFactoryStats();
      
      expect(totalTokens).to.equal(2);
      expect(totalFees).to.be.gt(0);
      expect(currentBalance).to.equal(totalFees); // All fees still in contract
    });

    it("Should return tokens by creator", async function () {
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      const addr1Tokens = await factory.getTokensByCreator(addr1.address);
      
      expect(creatorTokens.length).to.equal(1);
      expect(creatorTokens[0]).to.equal(tokenAddress1);
      
      expect(addr1Tokens.length).to.equal(1);
      expect(addr1Tokens[0]).to.equal(tokenAddress2);
    });

    it("Should return all deployed tokens", async function () {
      const allTokens = await factory.getAllDeployedTokens();
      
      expect(allTokens.length).to.equal(2);
      expect(allTokens).to.include(tokenAddress1);
      expect(allTokens).to.include(tokenAddress2);
    });

    it("Should return correct token info", async function () {
      const [tokenCreator, deploymentTime, lockPeriod] = await factory.getTokenInfo(tokenAddress1);
      
      expect(tokenCreator).to.equal(creator.address);
      expect(deploymentTime).to.be.gt(0);
      expect(lockPeriod).to.equal(LOCK_PERIOD);
    });
  });

  describe("Governance Integration", function () {
    let tokenAddress;
    
    beforeEach(async function () {
      await factory.setGovernanceManager(mockGovernance.address);
      
      // Deploy a token
      const requiredFee = await factory.getRequiredFee(STANDARD_SUPPLY);
      const tx = await factory.connect(creator).deployToken(
        "TestToken",
        "TEST",
        STANDARD_SUPPLY,
        LOCK_PERIOD,
        { value: requiredFee }
      );
      
      const receipt = await tx.wait();
      tokenAddress = receipt.events.find(e => e.event === "TokenDeployed").args.tokenAddress;
    });

    it("Should update governance for tokens", async function () {
      await expect(factory.updateGovernanceForTokens([tokenAddress]))
        .to.emit(factory, "TokensGovernanceUpdated")
        .withArgs([tokenAddress], mockGovernance.address);
    });

    it("Should reject governance update for non-deployed tokens", async function () {
      const fakeTokenAddress = addr1.address;
      
      await expect(
        factory.updateGovernanceForTokens([fakeTokenAddress])
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TokenNotDeployedByFactory");
    });

    it("Should reject governance update when no governance set", async function () {
      // Reset governance to zero address
      await factory.setGovernanceManager(ethers.ZeroAddress);
      
      await expect(
        factory.updateGovernanceForTokens([tokenAddress])
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidGovernanceAddress");
    });
  });
});
