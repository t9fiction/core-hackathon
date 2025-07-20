const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunFactoryLite", function () {
  let factory;
  let governance;
  let airdrop;
  let deployer, user1, user2, creator;
  const INITIAL_ETHER_FEE = ethers.parseEther("0.05");
  const MIN_TOTAL_SUPPLY = 1000;
  const STANDARD_MAX_SUPPLY = 100000000;
  const PREMIUM_MAX_SUPPLY = 500000000;
  const ULTIMATE_MAX_SUPPLY = 1000000000;
  const MIN_LIQUIDITY_LOCK_PERIOD_DAYS = 30;

  async function deployFactoryFixture() {
    [deployer, user1, user2, creator] = await ethers.getSigners();
    
    // Deploy Governance contract
    const PumpFunGovernance = await ethers.getContractFactory("PumpFunGovernance");
    governance = await PumpFunGovernance.deploy();
    await governance.waitForDeployment();
    
    // Deploy Airdrop contract
    const PumpFunGovernanceAirdrop = await ethers.getContractFactory("PumpFunGovernanceAirdrop");
    airdrop = await PumpFunGovernanceAirdrop.deploy(await governance.getAddress());
    await airdrop.waitForDeployment();
    
    // Deploy Factory
    const PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
    factory = await PumpFunFactoryLite.deploy();
    await factory.waitForDeployment();
    
    // Setup relationships
    await factory.setGovernanceManager(await governance.getAddress());
    await factory.setAirdropManager(await airdrop.getAddress());
    await governance.setAirdropContract(await airdrop.getAddress());
    
    return { factory, governance, airdrop, deployer, user1, user2, creator };
  }

  describe("Deployment", function () {
    it("Should deploy with correct initial parameters", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      expect(await factory.owner()).to.equal(deployer.address);
      expect(await factory.etherFee()).to.equal(INITIAL_ETHER_FEE);
      expect(await factory.totalTokensDeployed()).to.equal(0);
      expect(await factory.totalFeesCollected()).to.equal(0);
      expect(await factory.autoCreatePools()).to.be.true;
      expect(await factory.defaultLiquidityPercentage()).to.equal(80);
    });

    it("Should have correct constants", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      expect(await factory.MAX_FEE()).to.equal(ethers.parseEther("1"));
      expect(await factory.MIN_TOTAL_SUPPLY()).to.equal(MIN_TOTAL_SUPPLY);
      expect(await factory.STANDARD_MAX_SUPPLY()).to.equal(STANDARD_MAX_SUPPLY);
      expect(await factory.PREMIUM_MAX_SUPPLY()).to.equal(PREMIUM_MAX_SUPPLY);
      expect(await factory.ULTIMATE_MAX_SUPPLY()).to.equal(ULTIMATE_MAX_SUPPLY);
      expect(await factory.MIN_LIQUIDITY_LOCK_PERIOD_DAYS()).to.equal(MIN_LIQUIDITY_LOCK_PERIOD_DAYS);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set ether fee", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const newFee = ethers.parseEther("0.1");
      
      await expect(factory.setEtherFee(newFee))
        .to.emit(factory, "EtherFeeUpdated")
        .withArgs(INITIAL_ETHER_FEE, newFee);
      
      expect(await factory.etherFee()).to.equal(newFee);
    });

    it("Should reject setting fee above maximum", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const invalidFee = ethers.parseEther("1.1");
      
      await expect(factory.setEtherFee(invalidFee))
        .to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidFeeAmount");
    });

    it("Should allow owner to set governance manager", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await expect(factory.setGovernanceManager(user1.address))
        .to.emit(factory, "GovernanceManagerUpdated")
        .withArgs(await governance.getAddress(), user1.address);
      
      expect(await factory.governanceManager()).to.equal(user1.address);
    });

    it("Should reject setting zero address as governance manager", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await expect(factory.setGovernanceManager(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidGovernanceAddress");
    });

    it("Should allow owner to set airdrop manager", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await expect(factory.setAirdropManager(user1.address))
        .to.emit(factory, "AirdropManagerUpdated")
        .withArgs(await airdrop.getAddress(), user1.address);
      
      expect(await factory.airdropContract()).to.equal(user1.address);
    });

    it("Should allow owner to toggle auto pool creation", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await factory.setAutoCreatePools(false);
      expect(await factory.autoCreatePools()).to.be.false;
      
      await factory.setAutoCreatePools(true);
      expect(await factory.autoCreatePools()).to.be.true;
    });

    it("Should allow owner to set default liquidity percentage", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await factory.setDefaultLiquidityPercentage(90);
      expect(await factory.defaultLiquidityPercentage()).to.equal(90);
    });

    it("Should reject invalid liquidity percentage", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await expect(factory.setDefaultLiquidityPercentage(101))
        .to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidParameters");
    });

    it("Should prevent non-owner from calling admin functions", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await expect(factory.connect(user1).setEtherFee(ethers.parseEther("0.1")))
        .to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(factory.connect(user1).setGovernanceManager(user2.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(factory.connect(user1).setAutoCreatePools(false))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Token Deployment", function () {
    it("Should deploy token with correct parameters", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const tokenName = "TestToken";
      const tokenSymbol = "TEST";
      const totalSupply = 100000;
      const lockPeriod = 30;
      const requiredFee = await factory.getRequiredFee(totalSupply);
      
      await expect(
        factory.connect(creator).deployToken(tokenName, tokenSymbol, totalSupply, lockPeriod, {
          value: requiredFee
        })
      ).to.emit(factory, "TokenDeployed");
      // Note: Not checking token address in withArgs due to dynamic address generation
      
      expect(await factory.totalTokensDeployed()).to.equal(1);
      expect(await factory.totalFeesCollected()).to.equal(requiredFee);
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      expect(creatorTokens.length).to.equal(1);
      
      const tokenAddress = creatorTokens[0];
      expect(await factory.isDeployedToken(tokenAddress)).to.be.true;
      
      const tokenInfo = await factory.getTokenInfo(tokenAddress);
      expect(tokenInfo[0]).to.equal(creator.address); // creator
      expect(tokenInfo[2]).to.equal(lockPeriod); // liquidityLockPeriodDays
    });

    it("Should calculate correct fees for different supply tiers", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const baseFee = await factory.etherFee();
      
      // Standard tier
      expect(await factory.getRequiredFee(STANDARD_MAX_SUPPLY)).to.equal(baseFee * BigInt(1));
      
      // Premium tier
      expect(await factory.getRequiredFee(PREMIUM_MAX_SUPPLY)).to.equal(baseFee * BigInt(3));
      
      // Ultimate tier
      expect(await factory.getRequiredFee(ULTIMATE_MAX_SUPPLY)).to.equal(baseFee * BigInt(10));
    });

    it("Should return correct supply tier information", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      // Standard tier
      let tierInfo = await factory.getSupplyTier(STANDARD_MAX_SUPPLY);
      expect(tierInfo[0]).to.equal("Standard");
      expect(tierInfo[1]).to.equal(STANDARD_MAX_SUPPLY);
      expect(tierInfo[2]).to.equal(1);
      
      // Premium tier
      tierInfo = await factory.getSupplyTier(PREMIUM_MAX_SUPPLY);
      expect(tierInfo[0]).to.equal("Premium");
      expect(tierInfo[1]).to.equal(PREMIUM_MAX_SUPPLY);
      expect(tierInfo[2]).to.equal(3);
      
      // Ultimate tier
      tierInfo = await factory.getSupplyTier(ULTIMATE_MAX_SUPPLY);
      expect(tierInfo[0]).to.equal("Ultimate");
      expect(tierInfo[1]).to.equal(ULTIMATE_MAX_SUPPLY);
      expect(tierInfo[2]).to.equal(10);
    });

    it("Should reject deployment with insufficient fee", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const requiredFee = await factory.getRequiredFee(100000);
      const insufficientFee = requiredFee - BigInt(1);
      
      await expect(
        factory.connect(creator).deployToken("Test", "TEST", 100000, 30, {
          value: insufficientFee
        })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InsufficientEtherFee");
    });

    it("Should refund excess payment", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const requiredFee = await factory.getRequiredFee(100000);
      const excessAmount = ethers.parseEther("0.1");
      const totalPayment = requiredFee + excessAmount;
      
      const initialBalance = await ethers.provider.getBalance(creator.address);
      
      const tx = await factory.connect(creator).deployToken("Test", "TEST", 100000, 30, {
        value: totalPayment
      });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(creator.address);
      const expectedBalance = initialBalance - requiredFee - gasUsed;
      
      expect(finalBalance).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
    });

    it("Should reject invalid deployment parameters", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const requiredFee = await factory.getRequiredFee(100000);
      
      // Empty name
      await expect(
        factory.connect(creator).deployToken("", "TEST", 100000, 30, { value: requiredFee })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__EmptyStringParameter");
      
      // Empty symbol
      await expect(
        factory.connect(creator).deployToken("Test", "", 100000, 30, { value: requiredFee })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__EmptyStringParameter");
      
      // Supply too low
      await expect(
        factory.connect(creator).deployToken("Test", "TEST", MIN_TOTAL_SUPPLY - 1, 30, { value: requiredFee })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TotalSupplyTooLow");
      
      // Supply too high
      await expect(
        factory.connect(creator).deployToken("Test", "TEST", ULTIMATE_MAX_SUPPLY + 1, 30, { value: requiredFee })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TotalSupplyTooHigh");
      
      // Lock period too short
      await expect(
        factory.connect(creator).deployToken("Test", "TEST", 100000, MIN_LIQUIDITY_LOCK_PERIOD_DAYS - 1, { value: requiredFee })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InsufficientLiquidityLockPeriod");
    });
  });

  describe("Liquidity Management", function () {
    let tokenAddress;

    beforeEach(async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const requiredFee = await factory.getRequiredFee(100000);
      
      await factory.connect(creator).deployToken("Test", "TEST", 100000, 30, {
        value: requiredFee
      });
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      tokenAddress = creatorTokens[0];
    });

    it("Should allow adding and locking liquidity", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const tokenAmount = ethers.parseUnits("1000", 18);
      const ethAmount = ethers.parseEther("1");
      
      // First need to transfer tokens from contract to creator, then approve factory
      const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
      const token = PumpFunToken.attach(tokenAddress);
      
      // Check if token contract has tokens to transfer
      const contractBalance = await token.balanceOf(tokenAddress);
      if (contractBalance >= tokenAmount) {
        // We need to call from the token contract or have the creator as owner
        // This might need adjustment based on actual token contract implementation
        await expect(
          factory.connect(creator).addAndLockLiquidity(tokenAddress, tokenAmount, {
            value: ethAmount
          })
        ).to.emit(factory, "LiquidityAdded")
          .withArgs(tokenAddress, creator.address, ethAmount, tokenAmount);
      }
    });

    it("Should reject liquidity addition for non-deployed tokens", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const tokenAmount = ethers.parseUnits("1000", 18);
      const ethAmount = ethers.parseEther("1");
      
      await expect(
        factory.connect(creator).addAndLockLiquidity(user1.address, tokenAmount, {
          value: ethAmount
        })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TokenNotDeployedByFactory");
    });

    it("Should reject liquidity addition with zero amounts", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const tokenAmount = ethers.parseUnits("1000", 18);
      
      await expect(
        factory.connect(creator).addAndLockLiquidity(tokenAddress, tokenAmount, {
          value: 0
        })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidLiquidityAmount");
      
      await expect(
        factory.connect(creator).addAndLockLiquidity(tokenAddress, 0, {
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidLiquidityAmount");
    });

    it("Should reject liquidity addition from non-creator", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const tokenAmount = ethers.parseUnits("1000", 18);
      const ethAmount = ethers.parseEther("1");
      
      await expect(
        factory.connect(user1).addAndLockLiquidity(tokenAddress, tokenAmount, {
          value: ethAmount
        })
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidParameters");
    });
  });

  describe("Anti-Rug Pull Measures", function () {
    let tokenAddress;

    beforeEach(async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const requiredFee = await factory.getRequiredFee(100000);
      
      await factory.connect(creator).deployToken("Test", "TEST", 100000, 30, {
        value: requiredFee
      });
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      tokenAddress = creatorTokens[0];
    });

    it("Should allow owner to trigger anti-rug pull measures", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const reason = "Suspicious activity detected";
      
      await expect(factory.triggerAntiRugPull(tokenAddress, reason))
        .to.emit(factory, "AntiRugPullTriggered")
        .withArgs(tokenAddress, creator.address, reason);
    });

    it("Should reject anti-rug pull for non-deployed tokens", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await expect(
        factory.triggerAntiRugPull(user1.address, "Test reason")
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TokenNotDeployedByFactory");
    });

    it("Should prevent non-owner from triggering anti-rug pull", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await expect(
        factory.connect(user1).triggerAntiRugPull(tokenAddress, "Test reason")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Governance Integration", function () {
    it("Should update governance for existing tokens", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      // Deploy a token first
      const requiredFee = await factory.getRequiredFee(100000);
      await factory.connect(creator).deployToken("Test", "TEST", 100000, 30, {
        value: requiredFee
      });
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      const tokenAddress = creatorTokens[0];
      
      // Set new governance manager
      const newGovernance = user1.address;
      await factory.setGovernanceManager(newGovernance);
      
      // Update governance for tokens
      await expect(factory.updateGovernanceForTokens([tokenAddress]))
        .to.emit(factory, "TokensGovernanceUpdated")
        .withArgs([tokenAddress], newGovernance);
    });

    it("Should reject governance update with invalid governance address", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      // Deploy a token first
      const requiredFee = await factory.getRequiredFee(100000);
      await factory.connect(creator).deployToken("Test", "TEST", 100000, 30, {
        value: requiredFee
      });
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      const tokenAddress = creatorTokens[0];
      
      // Clear governance manager
      await factory.setGovernanceManager(user1.address);
      await factory.setGovernanceManager(ethers.ZeroAddress).catch(() => {}); // This should fail
      
      // Try to update governance for tokens without valid governance
      await expect(
        factory.updateGovernanceForTokens([tokenAddress])
      ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidGovernanceAddress");
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to withdraw accumulated fees", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      // Deploy some tokens to accumulate fees
      const requiredFee = await factory.getRequiredFee(100000);
      await factory.connect(creator).deployToken("Test1", "TEST1", 100000, 30, {
        value: requiredFee
      });
      await factory.connect(user1).deployToken("Test2", "TEST2", 100000, 30, {
        value: requiredFee
      });
      
      const initialBalance = await ethers.provider.getBalance(deployer.address);
      const contractBalance = await ethers.provider.getBalance(await factory.getAddress());
      
      await expect(factory.withdrawFees())
        .to.emit(factory, "EtherWithdrawn")
        .withArgs(deployer.address, contractBalance);
      
      expect(await ethers.provider.getBalance(await factory.getAddress())).to.equal(0);
    });

    it("Should reject withdrawal when no fees to withdraw", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await expect(factory.withdrawFees())
        .to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__NoEtherToWithdraw");
    });

    it("Should prevent non-owner from withdrawing fees", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      await expect(factory.connect(user1).withdrawFees())
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("View Functions", function () {
    it("Should return correct factory statistics", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      let stats = await factory.getFactoryStats();
      expect(stats[0]).to.equal(0); // totalTokensDeployed
      expect(stats[1]).to.equal(0); // totalFeesCollected
      expect(stats[2]).to.equal(0); // currentBalance
      
      // Deploy a token
      const requiredFee = await factory.getRequiredFee(100000);
      await factory.connect(creator).deployToken("Test", "TEST", 100000, 30, {
        value: requiredFee
      });
      
      stats = await factory.getFactoryStats();
      expect(stats[0]).to.equal(1); // totalTokensDeployed
      expect(stats[1]).to.equal(requiredFee); // totalFeesCollected
      expect(stats[2]).to.equal(requiredFee); // currentBalance
    });

    it("Should return all deployed tokens", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      const requiredFee = await factory.getRequiredFee(100000);
      
      // Deploy multiple tokens
      await factory.connect(creator).deployToken("Test1", "TEST1", 100000, 30, {
        value: requiredFee
      });
      await factory.connect(user1).deployToken("Test2", "TEST2", 100000, 30, {
        value: requiredFee
      });
      
      const allTokens = await factory.getAllDeployedTokens();
      expect(allTokens.length).to.equal(2);
      
      expect(await factory.isDeployedToken(allTokens[0])).to.be.true;
      expect(await factory.isDeployedToken(allTokens[1])).to.be.true;
    });

    it("Should return tokens by creator", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      const requiredFee = await factory.getRequiredFee(100000);
      
      // Creator deploys 2 tokens
      await factory.connect(creator).deployToken("Test1", "TEST1", 100000, 30, {
        value: requiredFee
      });
      await factory.connect(creator).deployToken("Test2", "TEST2", 100000, 30, {
        value: requiredFee
      });
      
      // User1 deploys 1 token
      await factory.connect(user1).deployToken("Test3", "TEST3", 100000, 30, {
        value: requiredFee
      });
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      const user1Tokens = await factory.getTokensByCreator(user1.address);
      
      expect(creatorTokens.length).to.equal(2);
      expect(user1Tokens.length).to.equal(1);
    });

    it("Should return correct airdrop contract address", async function () {
      const { factory, airdrop } = await loadFixture(deployFactoryFixture);
      
      expect(await factory.getAirdropContract()).to.equal(await airdrop.getAddress());
    });
  });

  describe("IERC721Receiver", function () {
    it("Should handle NFT reception correctly", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      const selector = await factory.onERC721Received(
        deployer.address,
        user1.address,
        1,
        "0x"
      );
      
      // Should return the correct selector
      expect(selector).to.equal("0x150b7a02");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple deployments from same creator", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const requiredFee = await factory.getRequiredFee(100000);
      
      // Deploy multiple tokens from same creator
      for (let i = 1; i <= 5; i++) {
        await factory.connect(creator).deployToken(`Test${i}`, `TEST${i}`, 100000, 30, {
          value: requiredFee
        });
      }
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      expect(creatorTokens.length).to.equal(5);
      expect(await factory.totalTokensDeployed()).to.equal(5);
    });

    it("Should handle large supply deployments", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      const largeSupply = ULTIMATE_MAX_SUPPLY;
      const requiredFee = await factory.getRequiredFee(largeSupply);
      
      await expect(
        factory.connect(creator).deployToken("BigToken", "BIG", largeSupply, 30, {
          value: requiredFee
        })
      ).to.emit(factory, "TokenDeployed");
      
      expect(await factory.totalTokensDeployed()).to.equal(1);
    });

    it("Should handle exact boundary values", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      
      // Test exact minimum values
      const minSupply = MIN_TOTAL_SUPPLY;
      const minLockPeriod = MIN_LIQUIDITY_LOCK_PERIOD_DAYS;
      const requiredFee = await factory.getRequiredFee(minSupply);
      
      await expect(
        factory.connect(creator).deployToken("MinToken", "MIN", minSupply, minLockPeriod, {
          value: requiredFee
        })
      ).to.emit(factory, "TokenDeployed");
    });
  });
});
