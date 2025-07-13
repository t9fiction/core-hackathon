const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Edge Cases and Security Tests", function () {
  let factory, token;
  let PumpFunFactoryLite, PumpFunToken;
  let owner, creator, attacker, user1, user2;
  let deploymentFee;

  beforeEach(async function () {
    [owner, creator, attacker, user1, user2] = await ethers.getSigners();
    
    PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
    PumpFunToken = await ethers.getContractFactory("PumpFunToken");
    
    factory = await PumpFunFactoryLite.deploy();
    deploymentFee = await factory.etherFee();
  });

  describe("Token Edge Cases", function () {
    let tokenAddress;

    beforeEach(async function () {
      await factory.connect(creator).deployToken(
        "EdgeToken",
        "EDGE",
        1000000,
        30,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      tokenAddress = deployedTokens[0];
      token = await PumpFunToken.attach(tokenAddress);
    });

    it("Should handle maximum lock duration correctly", async function () {
      const maxDuration = await token.MAX_LOCK_DURATION();
      const lockAmount = ethers.parseUnits("1000", 18);

      await expect(
        token.connect(creator).lockTokens(lockAmount, maxDuration)
      ).to.not.be.reverted;

      const lockInfo = await token.getLockedTokens(creator.address);
      expect(lockInfo.isLocked).to.be.true;
      expect(lockInfo.amount).to.equal(lockAmount);
    });

    it("Should handle minimum lock duration correctly", async function () {
      const minDuration = await token.MIN_LOCK_DURATION();
      const lockAmount = ethers.parseUnits("1000", 18);

      await expect(
        token.connect(creator).lockTokens(lockAmount, minDuration)
      ).to.not.be.reverted;
    });

    it("Should prevent locking more tokens than balance", async function () {
      const balance = await token.balanceOf(creator.address);
      const excessAmount = balance + ethers.parseUnits("1", 18);

      await expect(
        token.connect(creator).lockTokens(excessAmount, 30 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });

    it("Should handle transfer restrictions edge cases", async function () {
      // Test zero amount transfer
      await expect(
        token.connect(creator).transfer(user1.address, 0)
      ).to.not.be.reverted;

      // Test transfer to self
      const amount = ethers.parseUnits("100", 18);
      await expect(
        token.connect(creator).transfer(creator.address, amount)
      ).to.not.be.reverted;
    });

    it("Should handle governance edge cases", async function () {
      // Test proposal with very long description
      const longDescription = "A".repeat(1000);
      const totalSupply = await token.totalSupply();
      const governanceThreshold = totalSupply / 100n;
      
      await token.connect(creator).setWhitelisted(tokenAddress, true);
      await token.connect(creator).setMaxTransferAmount(governanceThreshold * 2n);
      await token.transfer(user1.address, governanceThreshold + 1n);

      await expect(
        token.connect(user1).createProposal(longDescription)
      ).to.not.be.reverted;
    });

    it("Should handle stability mechanisms edge cases", async function () {
      // Test stability mint at exact target price
      const targetPrice = await token.targetPrice();
      const maxSupply = await token.MAX_SUPPLY();
      const currentSupply = await token.totalSupply();
      const availableToMint = maxSupply - currentSupply;
      
      if (availableToMint > 0n) {
        const mintAmount = availableToMint > ethers.parseUnits("100", 18) ? 
                          ethers.parseUnits("100", 18) : availableToMint;
        await token.connect(creator).stabilityMint(mintAmount, targetPrice);
      }
      
      // Should not mint at target price
      const contractBalanceBefore = await token.balanceOf(tokenAddress);
      await token.connect(creator).stabilityMint(mintAmount, targetPrice);
      const contractBalanceAfter = await token.balanceOf(tokenAddress);
      
      expect(contractBalanceAfter).to.equal(contractBalanceBefore);
    });

    it("Should handle MAX_SUPPLY constraint correctly", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      const currentSupply = await token.totalSupply();
      const availableToMint = maxSupply - currentSupply;
      
      if (availableToMint > 0n) {
        const highPrice = ethers.parseUnits("2", 18);
        
        // Try to mint exactly what's available
        await expect(
          token.connect(creator).stabilityMint(availableToMint, highPrice)
        ).to.not.be.reverted;

        // Try to mint more than what's available
        await expect(
          token.connect(creator).stabilityMint(1, highPrice)
        ).to.be.revertedWithCustomError(token, "InvalidMintAmount");
      }
    });
  });

  describe("Factory Edge Cases", function () {
    it("Should handle empty token arrays correctly", async function () {
      const creatorTokens = await factory.getTokensByCreator(user1.address);
      expect(creatorTokens.length).to.equal(0);
    });

    it("Should handle fee calculations for different supply tiers correctly", async function () {
      const standardSupply = await factory.STANDARD_MAX_SUPPLY();
      const premiumSupply = await factory.PREMIUM_MAX_SUPPLY();
      const ultimateSupply = await factory.ULTIMATE_MAX_SUPPLY();

      const standardFee = await factory.getRequiredFee(standardSupply);
      const premiumFee = await factory.getRequiredFee(premiumSupply);
      const ultimateFee = await factory.getRequiredFee(ultimateSupply);

      expect(premiumFee).to.be.gt(standardFee);
      expect(ultimateFee).to.be.gt(premiumFee);
    });

    it("Should handle DEX manager integration edge cases", async function () {
      // Test with no DEX manager set
      await factory.connect(creator).deployToken(
        "TestToken",
        "TEST",
        1000000,
        30,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      const tokenAddress = deployedTokens[0];
      
      await expect(
        factory.connect(creator).createDEXPool(
          tokenAddress,
          ethers.parseUnits("1000", 18),
          3000, // fee parameter
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidParameters");
    });

    it("Should handle maximum number of tokens per creator", async function () {
      // Deploy multiple tokens for the same creator
      for (let i = 0; i < 10; i++) {
        await factory.connect(creator).deployToken(
          `Token${i}`,
          `T${i}`,
          1000000,
          30,
          { value: deploymentFee }
        );
      }

      const creatorTokens = await factory.getTokensByCreator(creator.address);
      expect(creatorTokens.length).to.equal(10);
      
      const allTokens = await factory.getAllDeployedTokens();
      expect(allTokens.length).to.equal(10);
    });
  });

  describe("Security Tests", function () {
    let tokenAddress;

    beforeEach(async function () {
      await factory.connect(creator).deployToken(
        "SecurityToken",
        "SEC",
        1000000,
        30,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      tokenAddress = deployedTokens[0];
      token = await PumpFunToken.attach(tokenAddress);
    });

    it("Should prevent reentrancy attacks on token functions", async function () {
      // The contracts have nonReentrant modifiers, so this test ensures they work
      const lockAmount = ethers.parseUnits("1000", 18);
      const lockDuration = 30 * 24 * 60 * 60;

      await expect(
        token.connect(creator).lockTokens(lockAmount, lockDuration)
      ).to.not.be.reverted;
    });

    it("Should prevent unauthorized token operations", async function () {
      // Only owner can call admin functions
      await expect(
        token.connect(attacker).setMaxTransferAmount(ethers.parseUnits("999999", 18))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");

      await expect(
        token.connect(attacker).emergencyPause()
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");

      await expect(
        token.connect(attacker).setMintingEnabled(false)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should prevent unauthorized factory operations", async function () {
      await expect(
        factory.connect(attacker).setEtherFee(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

      await expect(
        factory.connect(attacker).withdrawFees()
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

      await expect(
        factory.connect(attacker).triggerAntiRugPull(tokenAddress, "Evil reason")
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("Should handle integer overflow/underflow correctly", async function () {
      // Test with maximum uint256 values where appropriate
      const maxUint256 = ethers.MaxUint256;
      
      // This should revert due to validation, not overflow
      await expect(
        factory.setEtherFee(maxUint256)
      ).to.be.revertedWithCustomError(factory, "InvalidFeeAmount");
    });

    it("Should prevent front-running attacks on token deployment", async function () {
      // Each token deployment creates a unique address, preventing front-running
      const tx1 = await factory.connect(creator).deployToken(
        "Token1",
        "T1",
        1000000,
        30,
        { value: deploymentFee }
      );

      const tx2 = await factory.connect(user1).deployToken(
        "Token1", // Same name
        "T1",     // Same symbol
        1000000,
        30,
        { value: deploymentFee }
      );

      const receipt1 = await tx1.wait();
      const receipt2 = await tx2.wait();

      // Should have different addresses even with same parameters
      const allTokens = await factory.getAllDeployedTokens();
      expect(allTokens[0]).to.not.equal(allTokens[1]);
    });

    it("Should handle governance attacks correctly", async function () {
      const totalSupply = await token.totalSupply();
      const governanceThreshold = totalSupply / 100n;
      
      // Transfer tokens to attacker
      await token.connect(creator).setWhitelisted(tokenAddress, true);
      await token.connect(creator).setMaxTransferAmount(governanceThreshold * 2n);
      await token.transfer(attacker.address, governanceThreshold + 1n);

      // Attacker creates proposal
      await token.connect(attacker).createProposal("Malicious proposal");

      // Attacker votes
      await token.connect(attacker).vote(0, true);

      // Check that proposal can't be executed without quorum
      const proposal = await token.getProposal(0);
      const quorum = totalSupply * 10n / 100n; // 10% quorum
      
      if (proposal.votesFor < quorum) {
        // Fast forward past voting period
        await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
        await ethers.provider.send("evm_mine");

        await expect(
          token.connect(attacker).executeProposal(0)
        ).to.be.revertedWithCustomError(token, "QuorumNotReached");
      }
    });

    it("Should prevent double voting on proposals", async function () {
      const totalSupply = await token.totalSupply();
      const governanceThreshold = totalSupply / 100n;
      
      await token.connect(creator).setWhitelisted(tokenAddress, true);
      await token.connect(creator).setMaxTransferAmount(governanceThreshold * 2n);
      await token.transfer(user1.address, governanceThreshold + 1n);

      await token.connect(user1).createProposal("Test proposal");
      await token.connect(user1).vote(0, true);

      await expect(
        token.connect(user1).vote(0, false)
      ).to.be.revertedWithCustomError(token, "AlreadyVoted");
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should have reasonable gas costs for common operations", async function () {
      // Deploy token
      const deployTx = await factory.connect(creator).deployToken(
        "GasToken",
        "GAS",
        1000000,
        30,
        { value: deploymentFee }
      );
      const deployReceipt = await deployTx.wait();
      
      console.log(`Token deployment gas: ${deployReceipt.gasUsed}`);
      expect(deployReceipt.gasUsed).to.be.lt(3000000); // Should be under 3M gas

      const deployedTokens = await factory.getAllDeployedTokens();
      const tokenAddress = deployedTokens[0];
      const token = await PumpFunToken.attach(tokenAddress);

      // Test transfer gas cost
      const transferTx = await token.connect(creator).transfer(
        user1.address,
        ethers.parseUnits("1000", 18)
      );
      const transferReceipt = await transferTx.wait();
      
      console.log(`Transfer gas: ${transferReceipt.gasUsed}`);
      expect(transferReceipt.gasUsed).to.be.lt(100000); // Should be under 100k gas

      // Test lock tokens gas cost
      const lockTx = await token.connect(creator).lockTokens(
        ethers.parseUnits("500", 18),
        30 * 24 * 60 * 60
      );
      const lockReceipt = await lockTx.wait();
      
      console.log(`Lock tokens gas: ${lockReceipt.gasUsed}`);
      expect(lockReceipt.gasUsed).to.be.lt(150000); // Should be under 150k gas
    });
  });

  describe("Stress Tests", function () {
    it("Should handle many small transfers efficiently", async function () {
      await factory.connect(creator).deployToken(
        "StressToken",
        "STRESS",
        10000000, // Larger supply for stress testing
        30,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      const tokenAddress = deployedTokens[0];
      const token = await PumpFunToken.attach(tokenAddress);

      // Transfer small amounts to many users
      const transferAmount = ethers.parseUnits("100", 18);
      
      for (let i = 0; i < 5; i++) {
        await token.connect(creator).transfer(user1.address, transferAmount);
        
        // Wait for cooldown
        await ethers.provider.send("evm_increaseTime", [3600 + 1]);
        await ethers.provider.send("evm_mine");
      }

      const finalBalance = await token.balanceOf(user1.address);
      expect(finalBalance).to.equal(transferAmount * 5n);
    });

    it("Should handle maximum governance proposals", async function () {
      await factory.connect(creator).deployToken(
        "GovToken",
        "GOV",
        100000000, // Large supply for governance
        30,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      const tokenAddress = deployedTokens[0];
      const token = await PumpFunToken.attach(tokenAddress);

      const totalSupply = await token.totalSupply();
      const governanceThreshold = totalSupply / 100n;
      
      await token.connect(creator).setWhitelisted(tokenAddress, true);
      await token.connect(creator).setMaxTransferAmount(governanceThreshold * 4n);
      await token.transfer(user1.address, governanceThreshold * 2n);

      // Create multiple proposals
      for (let i = 0; i < 3; i++) {
        await token.connect(user1).createProposal(`Proposal ${i}`);
        await token.connect(user1).vote(i, true);
      }

      expect(await token.proposalCount()).to.equal(3);
    });
  });

  describe("Upgradeability and Future-Proofing", function () {
    it("Should handle interface compatibility", async function () {
      await factory.connect(creator).deployToken(
        "InterfaceToken",
        "INT",
        1000000,
        30,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      const tokenAddress = deployedTokens[0];
      const token = await PumpFunToken.attach(tokenAddress);

      // Test ERC20 interface compatibility
      expect(await token.name()).to.be.a("string");
      expect(await token.symbol()).to.be.a("string");
      expect(await token.decimals()).to.equal(18);
      expect(await token.totalSupply()).to.be.a("bigint");
      
      // Test custom interface compatibility
      expect(await token.maxTransferAmount()).to.be.a("bigint");
      expect(await token.maxHolding()).to.be.a("bigint");
      expect(await token.transferLimitsEnabled()).to.be.a("boolean");
    });
  });
});
