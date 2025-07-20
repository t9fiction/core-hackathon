const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Integration Tests", function () {
  let factory, governance, airdrop, token;
  let deployer, creator, user1, user2, voter1, voter2;
  
  const INITIAL_SUPPLY = 100000;
  const LOCK_PERIOD_DAYS = 30;
  const TOKEN_SUPPLY = ethers.parseUnits(INITIAL_SUPPLY.toString(), 18);

  async function deployFullSystemFixture() {
    [deployer, creator, user1, user2, voter1, voter2] = await ethers.getSigners();
    
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
    
    return { factory, governance, airdrop, deployer, creator, user1, user2, voter1, voter2 };
  }

  async function deployTokenThroughFactory() {
    const { factory } = await loadFixture(deployFullSystemFixture);
    const requiredFee = await factory.getRequiredFee(INITIAL_SUPPLY);
    
    await factory.connect(creator).deployToken("TestToken", "TEST", INITIAL_SUPPLY, LOCK_PERIOD_DAYS, {
      value: requiredFee
    });
    
    const creatorTokens = await factory.getTokensByCreator(creator.address);
    const tokenAddress = creatorTokens[0];
    
    const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
    token = PumpFunToken.attach(tokenAddress);
    
    return { factory, governance, airdrop, token, deployer, creator, user1, user2, voter1, voter2 };
  }

  describe("End-to-End Token Lifecycle", function () {
    it("Should deploy token through factory and set up governance", async function () {
      const { token, governance, factory } = await loadFixture(deployTokenThroughFactory);
      
      // Verify token was deployed correctly
      expect(await token.name()).to.equal("TestToken");
      expect(await token.symbol()).to.equal("TEST");
      expect(await token.owner()).to.equal(creator.address);
      
      // Verify factory tracking
      expect(await factory.totalTokensDeployed()).to.equal(1);
      expect(await factory.isDeployedToken(await token.getAddress())).to.be.true;
      
      // Verify governance is set
      expect(await token.governanceContract()).to.equal(await governance.getAddress());
    });

    it("Should handle complete governance proposal workflow", async function () {
      const { token, governance } = await loadFixture(deployTokenThroughFactory);
      
      // Give voting power to voters
      const voterAmount = ethers.parseUnits("50000", 18); // 5% each
      await token.connect(creator).transfer(voter1.address, voterAmount);
      await token.connect(creator).transfer(voter2.address, voterAmount);
      
      // Create proposal to change max transfer amount
      const newMaxTransfer = ethers.parseUnits("5000", 18);
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Increase max transfer amount",
        1, // Max transfer amount
        newMaxTransfer,
        [],
        []
      );
      
      // Vote on proposal
      await governance.connect(voter1).vote(0, true);
      await governance.connect(voter2).vote(0, true);
      
      // Fast forward past voting period
      await time.increase(7 * 24 * 60 * 60 + 1); // 7 days + 1 second
      
      // Execute proposal
      await governance.connect(voter1).executeProposal(0);
      
      // Verify proposal was executed
      const proposal = await governance.getProposal(0);
      expect(proposal.executed).to.be.true;
      expect(proposal.active).to.be.false;
    });

    it("Should handle airdrop through governance", async function () {
      const { token, governance, airdrop } = await loadFixture(deployTokenThroughFactory);
      
      // Give voting power to voters
      const voterAmount = ethers.parseUnits("50000", 18); // 5% each
      await token.connect(creator).transfer(voter1.address, voterAmount);
      await token.connect(creator).transfer(voter2.address, voterAmount);
      
      // Transfer tokens to airdrop contract for distribution
      const airdropAmount = ethers.parseUnits("1000", 18);
      await token.transfer(await airdrop.getAddress(), airdropAmount);
      
      // Create airdrop proposal
      const recipients = [user1.address, user2.address];
      const amounts = [ethers.parseUnits("300", 18), ethers.parseUnits("500", 18)];
      
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Community airdrop",
        4, // Airdrop
        0,
        recipients,
        amounts
      );
      
      // Vote and execute
      await governance.connect(voter1).vote(0, true);
      await governance.connect(voter2).vote(0, true);
      await time.increase(7 * 24 * 60 * 60 + 1);
      await governance.connect(voter1).executeProposal(0);
      
      // Verify airdrop was executed
      expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(user2.address)).to.equal(amounts[1]);
      
      // Verify claimed status
      expect(await airdrop.claimed(await token.getAddress(), user1.address)).to.be.true;
      expect(await airdrop.claimed(await token.getAddress(), user2.address)).to.be.true;
    });

    it("Should handle token locking and transfer restrictions", async function () {
      const { token } = await loadFixture(deployTokenThroughFactory);
      
      const lockAmount = ethers.parseUnits("1000", 18);
      const lockDuration = 86400; // 1 day
      
      // Lock tokens
      await token.connect(creator).lockTokens(lockAmount, lockDuration);
      
      // Verify lock
      const lockInfo = await token.getLockedTokens(creator.address);
      expect(lockInfo[0]).to.equal(lockAmount);
      expect(lockInfo[2]).to.be.true; // isLocked
      
      // Test transfer restrictions
      const maxTransfer = await token.maxTransferAmount();
      
      // Should work within limits
      await token.connect(creator).transfer(user1.address, maxTransfer);
      
      // Should fail beyond limits
      await expect(
        token.connect(creator).transfer(user1.address, maxTransfer + BigInt(1))
      ).to.be.revertedWithCustomError(token, "PumpFunToken__ExceedsMaxTransferAmount");
      
      // Unlock after time passes
      await time.increase(lockDuration + 1);
      await token.connect(creator).unlockTokens();
      
      const updatedLockInfo = await token.getLockedTokens(creator.address);
      expect(updatedLockInfo[2]).to.be.false; // isLocked
    });

    it("Should handle emergency pause functionality", async function () {
      const { token } = await loadFixture(deployTokenThroughFactory);
      
      // Pause token
      await token.connect(creator).emergencyPause();
      expect(await token.paused()).to.be.true;
      
      // Transfers should fail
      await expect(
        token.connect(creator).transfer(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause
      await token.connect(creator).emergencyUnpause();
      expect(await token.paused()).to.be.false;
      
      // Transfers should work again
      await token.connect(creator).transfer(user1.address, ethers.parseUnits("100", 18));
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("100", 18));
    });

    it("Should handle anti-rug pull measures", async function () {
      const { token, factory } = await loadFixture(deployTokenThroughFactory);
      
      // Factory owner can trigger anti-rug pull
      await expect(
        factory.triggerAntiRugPull(await token.getAddress(), "Suspicious activity")
      ).to.emit(factory, "AntiRugPullTriggered");
      
      // Token should be paused
      expect(await token.paused()).to.be.true;
    });

    it("Should handle fee collection and withdrawal", async function () {
      const { factory } = await loadFixture(deployFullSystemFixture);
      
      const requiredFee = await factory.getRequiredFee(INITIAL_SUPPLY);
      const initialBalance = await ethers.provider.getBalance(deployer.address);
      
      // Deploy token (accumulates fees)
      await factory.connect(creator).deployToken("Test1", "TEST1", INITIAL_SUPPLY, LOCK_PERIOD_DAYS, {
        value: requiredFee
      });
      
      // Deploy another token
      await factory.connect(user1).deployToken("Test2", "TEST2", INITIAL_SUPPLY, LOCK_PERIOD_DAYS, {
        value: requiredFee
      });
      
      // Verify fees accumulated
      expect(await factory.totalFeesCollected()).to.equal(requiredFee * BigInt(2));
      
      // Withdraw fees
      const contractBalance = await ethers.provider.getBalance(await factory.getAddress());
      await expect(factory.withdrawFees())
        .to.emit(factory, "EtherWithdrawn")
        .withArgs(deployer.address, contractBalance);
      
      // Contract balance should be zero
      expect(await ethers.provider.getBalance(await factory.getAddress())).to.equal(0);
    });
  });

  describe("Multiple Token Scenarios", function () {
    it("Should handle multiple tokens with separate governance", async function () {
      const { factory, governance } = await loadFixture(deployFullSystemFixture);
      
      const requiredFee = await factory.getRequiredFee(INITIAL_SUPPLY);
      
      // Deploy two tokens
      await factory.connect(creator).deployToken("Token1", "TK1", INITIAL_SUPPLY, LOCK_PERIOD_DAYS, {
        value: requiredFee
      });
      await factory.connect(user1).deployToken("Token2", "TK2", INITIAL_SUPPLY, LOCK_PERIOD_DAYS, {
        value: requiredFee
      });
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      const user1Tokens = await factory.getTokensByCreator(user1.address);
      
      const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
      const token1 = PumpFunToken.attach(creatorTokens[0]);
      const token2 = PumpFunToken.attach(user1Tokens[0]);
      
      // Give voting power for both tokens
      await token1.connect(creator).transfer(voter1.address, ethers.parseUnits("10000", 18));
      await token2.connect(user1).transfer(voter1.address, ethers.parseUnits("10000", 18));
      
      // Create proposals for both tokens
      await governance.connect(voter1).createProposal(
        await token1.getAddress(),
        "Proposal for token 1",
        1,
        ethers.parseUnits("2000", 18),
        [],
        []
      );
      
      await governance.connect(voter1).createProposal(
        await token2.getAddress(),
        "Proposal for token 2",
        1,
        ethers.parseUnits("3000", 18),
        [],
        []
      );
      
      expect(await governance.proposalCount()).to.equal(2);
      
      // Verify proposals are for different tokens
      const proposal1 = await governance.getProposal(0);
      const proposal2 = await governance.getProposal(1);
      
      expect(proposal1.token).to.equal(await token1.getAddress());
      expect(proposal2.token).to.equal(await token2.getAddress());
      expect(proposal1.proposedValue).to.equal(ethers.parseUnits("2000", 18));
      expect(proposal2.proposedValue).to.equal(ethers.parseUnits("3000", 18));
    });

    it("Should handle different supply tiers correctly", async function () {
      const { factory } = await loadFixture(deployFullSystemFixture);
      
      const standardSupply = 50000000; // 50M - Standard
      const premiumSupply = 300000000; // 300M - Premium  
      const ultimateSupply = 800000000; // 800M - Ultimate
      
      const standardFee = await factory.getRequiredFee(standardSupply);
      const premiumFee = await factory.getRequiredFee(premiumSupply);
      const ultimateFee = await factory.getRequiredFee(ultimateSupply);
      
      const baseFee = await factory.etherFee();
      
      // Verify fee calculations
      expect(standardFee).to.equal(baseFee * BigInt(1));
      expect(premiumFee).to.equal(baseFee * BigInt(3));
      expect(ultimateFee).to.equal(baseFee * BigInt(10));
      
      // Deploy tokens with different supplies
      await factory.connect(creator).deployToken("Standard", "STD", standardSupply, LOCK_PERIOD_DAYS, {
        value: standardFee
      });
      
      await factory.connect(user1).deployToken("Premium", "PREM", premiumSupply, LOCK_PERIOD_DAYS, {
        value: premiumFee
      });
      
      await factory.connect(user2).deployToken("Ultimate", "ULT", ultimateSupply, LOCK_PERIOD_DAYS, {
        value: ultimateFee
      });
      
      expect(await factory.totalTokensDeployed()).to.equal(3);
      expect(await factory.totalFeesCollected()).to.equal(standardFee + premiumFee + ultimateFee);
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should prevent unauthorized governance actions", async function () {
      const { token, governance } = await loadFixture(deployTokenThroughFactory);
      
      // Non-governance contract cannot call governance functions
      await expect(
        token.connect(user1).transferAirdrop([user2.address], [ethers.parseUnits("100", 18)])
      ).to.be.revertedWithCustomError(token, "PumpFunToken__OnlyGovernance");
    });

    it("Should prevent factory-only function calls from non-factory", async function () {
      const { token } = await loadFixture(deployTokenThroughFactory);
      
      await expect(
        token.connect(user1).setGovernanceContract(user1.address)
      ).to.be.revertedWithCustomError(token, "PumpFunToken__OnlyFactory");
      
      await expect(
        token.connect(user1).lockLiquidity(user1.address, 1000, 86400)
      ).to.be.revertedWithCustomError(token, "PumpFunToken__OnlyFactory");
    });

    it("Should handle invalid proposal parameters", async function () {
      const { governance } = await loadFixture(deployTokenThroughFactory);
      
      // Invalid token address
      await expect(
        governance.connect(voter1).createProposal(
          ethers.ZeroAddress,
          "Invalid proposal",
          1,
          1000,
          [],
          []
        )
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__InvalidToken");
      
      // Invalid proposal type
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          "Invalid type",
          10, // Invalid type
          1000,
          [],
          []
        )
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__InvalidProposalType");
    });

    it("Should handle governance state changes", async function () {
      const { governance, token } = await loadFixture(deployTokenThroughFactory);
      
      // Disable governance
      await governance.setGovernanceEnabled(false);
      
      // Should not be able to create proposals
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          "Should fail",
          1,
          1000,
          [],
          []
        )
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__GovernanceDisabled");
      
      // Re-enable governance
      await governance.setGovernanceEnabled(true);
      
      // Should work again (if user has voting power)
      const voterAmount = ethers.parseUnits("10000", 18);
      await token.connect(creator).transfer(voter1.address, voterAmount);
      
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          "Should work",
          1,
          1000,
          [],
          []
        )
      ).to.emit(governance, "ProposalCreated");
    });
  });

  describe("Gas Efficiency Tests", function () {
    it("Should handle batch operations efficiently", async function () {
      const { factory } = await loadFixture(deployFullSystemFixture);
      
      const requiredFee = await factory.getRequiredFee(INITIAL_SUPPLY);
      const initialGas = await ethers.provider.getBalance(creator.address);
      
      // Deploy multiple tokens in sequence
      const deployPromises = [];
      for (let i = 1; i <= 5; i++) {
        deployPromises.push(
          factory.connect(creator).deployToken(`Token${i}`, `TK${i}`, INITIAL_SUPPLY, LOCK_PERIOD_DAYS, {
            value: requiredFee
          })
        );
      }
      
      await Promise.all(deployPromises);
      
      expect(await factory.totalTokensDeployed()).to.equal(5);
      
      // Verify all tokens are tracked correctly
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      expect(creatorTokens.length).to.equal(5);
    });
  });
});
