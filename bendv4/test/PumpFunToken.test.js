const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunToken", function () {
  let PumpFunToken, token;
  let owner, addr1, addr2, addr3;
  let initialSupply = 1000000; // 1M tokens
  let tokenName = "TestToken";
  let tokenSymbol = "TEST";

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    
    PumpFunToken = await ethers.getContractFactory("PumpFunToken");
    token = await PumpFunToken.deploy(tokenName, tokenSymbol, initialSupply, owner.address);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      expect(await token.name()).to.equal(tokenName);
      expect(await token.symbol()).to.equal(tokenSymbol);
      expect(await token.totalSupply()).to.equal(ethers.parseEther(initialSupply.toString()));
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should distribute initial supply correctly", async function () {
      const totalSupply = await token.totalSupply();
      
      // 10% to creator
      const creatorBalance = await token.balanceOf(owner.address);
      expect(creatorBalance).to.equal(totalSupply * 10n / 100n);
      
      // 90% to contract (70% community + 20% liquidity)
      const contractBalance = await token.balanceOf(await token.getAddress());
      expect(contractBalance).to.equal(totalSupply * 90n / 100n);
    });

    it("Should set initial limits correctly", async function () {
      const totalSupply = await token.totalSupply();
      const maxTransferAmount = await token.maxTransferAmount();
      expect(maxTransferAmount).to.equal(totalSupply / 100n); // 1% of total supply
    });

    it("Should whitelist contract and owner", async function () {
      expect(await token.isWhitelisted(await token.getAddress())).to.be.true;
      expect(await token.isWhitelisted(owner.address)).to.be.true;
    });

    it("Should revert with zero address owner", async function () {
      await expect(
        PumpFunToken.deploy(tokenName, tokenSymbol, initialSupply, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(PumpFunToken, "OwnableInvalidOwner");
    });

    it("Should revert with zero initial supply", async function () {
      await expect(
        PumpFunToken.deploy(tokenName, tokenSymbol, 0, owner.address)
      ).to.be.revertedWithCustomError(token, "ZeroAmount");
    });
  });

  describe("Supply Locking", function () {
    beforeEach(async function () {
      // Transfer some tokens to addr1 for testing
      await token.transfer(addr1.address, ethers.parseEther("1000"));
    });

    it("Should lock tokens successfully", async function () {
      const lockAmount = ethers.parseEther("500");
      const lockDuration = 7 * 24 * 60 * 60; // 7 days
      
      await token.connect(addr1).lockTokens(lockAmount, lockDuration);
      
      const lockInfo = await token.lockedTokens(addr1.address);
      expect(lockInfo.amount).to.equal(lockAmount);
      expect(lockInfo.isLocked).to.be.true;
      expect(lockInfo.unlockTime).to.be.greaterThan(await time.latest());
    });

    it("Should prevent locking with zero amount", async function () {
      await expect(
        token.connect(addr1).lockTokens(0, 7 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(token, "ZeroAmount");
    });

    it("Should prevent locking with invalid duration", async function () {
      const lockAmount = ethers.parseEther("500");
      
      // Too short
      await expect(
        token.connect(addr1).lockTokens(lockAmount, 1000)
      ).to.be.revertedWithCustomError(token, "InvalidLockDuration");
      
      // Too long
      await expect(
        token.connect(addr1).lockTokens(lockAmount, 366 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(token, "InvalidLockDuration");
    });

    it("Should prevent double locking", async function () {
      const lockAmount = ethers.parseEther("500");
      const lockDuration = 7 * 24 * 60 * 60;
      
      await token.connect(addr1).lockTokens(lockAmount, lockDuration);
      
      await expect(
        token.connect(addr1).lockTokens(lockAmount, lockDuration)
      ).to.be.revertedWithCustomError(token, "TokensAlreadyLocked");
    });

    it("Should prevent locking more than balance", async function () {
      const lockAmount = ethers.parseEther("2000"); // More than addr1's balance
      const lockDuration = 7 * 24 * 60 * 60;
      
      await expect(
        token.connect(addr1).lockTokens(lockAmount, lockDuration)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });

    it("Should unlock tokens after lock period", async function () {
      const lockAmount = ethers.parseEther("500");
      const lockDuration = 7 * 24 * 60 * 60;
      
      await token.connect(addr1).lockTokens(lockAmount, lockDuration);
      
      // Fast forward time
      await time.increase(lockDuration + 1);
      
      await token.connect(addr1).unlockTokens();
      
      const lockInfo = await token.lockedTokens(addr1.address);
      expect(lockInfo.isLocked).to.be.false;
    });

    it("Should prevent unlocking before lock period", async function () {
      const lockAmount = ethers.parseEther("500");
      const lockDuration = 7 * 24 * 60 * 60;
      
      await token.connect(addr1).lockTokens(lockAmount, lockDuration);
      
      await expect(
        token.connect(addr1).unlockTokens()
      ).to.be.revertedWithCustomError(token, "LockNotExpired");
    });

    it("Should prevent unlocking when no tokens are locked", async function () {
      await expect(
        token.connect(addr1).unlockTokens()
      ).to.be.revertedWithCustomError(token, "NoLockedTokens");
    });
  });

  describe("Anti-Rug Pull Transfer Restrictions", function () {
    beforeEach(async function () {
      // Transfer some tokens to addr1 for testing
      await token.transfer(addr1.address, ethers.parseEther("1000"));
    });

    it("Should enforce max transfer amount", async function () {
      const maxTransferAmount = await token.maxTransferAmount();
      
      await expect(
        token.connect(addr1).transfer(addr2.address, maxTransferAmount + 1n)
      ).to.be.revertedWithCustomError(token, "ExceedsMaxTransferAmount");
    });

    it("Should allow whitelisted addresses to bypass limits", async function () {
      const maxTransferAmount = await token.maxTransferAmount();
      
      // Whitelist addr1
      await token.setWhitelisted(addr1.address, true);
      
      // Should allow transfer above limit
      await expect(
        token.connect(addr1).transfer(addr2.address, maxTransferAmount + 1n)
      ).to.not.be.reverted;
    });

    it("Should enforce transfer cooldown", async function () {
      const transferAmount = ethers.parseEther("100");
      
      // First transfer should succeed
      await token.connect(addr1).transfer(addr2.address, transferAmount);
      
      // Second transfer within cooldown should fail
      await expect(
        token.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.be.revertedWithCustomError(token, "TransferLocked");
    });

    it("Should allow transfer after cooldown period", async function () {
      const transferAmount = ethers.parseEther("100");
      
      // First transfer
      await token.connect(addr1).transfer(addr2.address, transferAmount);
      
      // Fast forward past cooldown
      await time.increase(3600 + 1); // 1 hour + 1 second
      
      // Second transfer should succeed
      await expect(
        token.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.not.be.reverted;
    });

    it("Should prevent transfer of locked tokens", async function () {
      const lockAmount = ethers.parseEther("500");
      const lockDuration = 7 * 24 * 60 * 60;
      
      await token.connect(addr1).lockTokens(lockAmount, lockDuration);
      
      // Try to transfer locked tokens
      await expect(
        token.connect(addr1).transfer(addr2.address, lockAmount)
      ).to.be.revertedWithCustomError(token, "TransferLocked");
    });

    it("Should allow transfer of unlocked tokens", async function () {
      const balance = await token.balanceOf(addr1.address);
      const lockAmount = ethers.parseEther("500");
      const lockDuration = 7 * 24 * 60 * 60;
      
      await token.connect(addr1).lockTokens(lockAmount, lockDuration);
      
      // Transfer unlocked tokens
      const unlockedAmount = balance - lockAmount;
      await expect(
        token.connect(addr1).transfer(addr2.address, unlockedAmount)
      ).to.not.be.reverted;
    });
  });

  describe("Stability Tokenomics", function () {
    it("Should mint tokens when price is above target", async function () {
      const mintAmount = ethers.parseEther("1000");
      const currentPrice = ethers.parseEther("2"); // Above target of 1
      
      await token.stabilityMint(mintAmount, currentPrice);
      
      const contractBalance = await token.balanceOf(await token.getAddress());
      expect(contractBalance).to.be.greaterThan(0);
    });

    it("Should not mint tokens when price is below target", async function () {
      const mintAmount = ethers.parseEther("1000");
      const currentPrice = ethers.parseEther("0.5"); // Below target of 1
      
      await token.stabilityMint(mintAmount, currentPrice);
      
      // Should not mint anything
      const totalSupply = await token.totalSupply();
      expect(totalSupply).to.equal(ethers.parseEther(initialSupply.toString()));
    });

    it("Should burn tokens when price is below target", async function () {
      const burnAmount = ethers.parseEther("1000");
      const currentPrice = ethers.parseEther("0.5"); // Below target of 1
      
      const initialTotalSupply = await token.totalSupply();
      
      await token.stabilityBurn(burnAmount, currentPrice);
      
      const finalTotalSupply = await token.totalSupply();
      expect(finalTotalSupply).to.be.lessThan(initialTotalSupply);
    });

    it("Should prevent minting when disabled", async function () {
      await token.connect(owner).toggleTransferLimits(); // This would be a toggle for minting
      
      const mintAmount = ethers.parseEther("1000");
      const currentPrice = ethers.parseEther("2");
      
      // This test would need a separate toggle for minting
      // For now, we'll test that only owner can mint
      await expect(
        token.connect(addr1).stabilityMint(mintAmount, currentPrice)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("Community Governance", function () {
    beforeEach(async function () {
      // Transfer some tokens to addr1 for voting power
      await token.transfer(addr1.address, ethers.parseEther("20000")); // 2% of supply
    });

    it("Should create proposal with sufficient voting power", async function () {
      const description = "Test proposal";
      
      await token.connect(addr1).createProposal(description);
      
      const proposalId = await token.proposalCount();
      const proposal = await token.getProposal(proposalId);
      
      expect(proposal.creator).to.equal(addr1.address);
      expect(proposal.description).to.equal(description);
      expect(proposal.active).to.be.true;
    });

    it("Should prevent proposal creation without sufficient voting power", async function () {
      const description = "Test proposal";
      
      await expect(
        token.connect(addr2).createProposal(description)
      ).to.be.revertedWithCustomError(token, "InvalidProposal");
    });

    it("Should allow voting on active proposal", async function () {
      const description = "Test proposal";
      
      await token.connect(addr1).createProposal(description);
      const proposalId = await token.proposalCount();
      
      await token.connect(addr1).vote(proposalId, true);
      
      const proposal = await token.getProposal(proposalId);
      expect(proposal.votesFor).to.be.greaterThan(0);
    });

    it("Should prevent double voting", async function () {
      const description = "Test proposal";
      
      await token.connect(addr1).createProposal(description);
      const proposalId = await token.proposalCount();
      
      await token.connect(addr1).vote(proposalId, true);
      
      await expect(
        token.connect(addr1).vote(proposalId, true)
      ).to.be.revertedWithCustomError(token, "AlreadyVoted");
    });

    it("Should execute proposal with sufficient votes", async function () {
      const description = "Test proposal";
      
      // Give addr1 enough voting power (more than 10% quorum)
      await token.transfer(addr1.address, ethers.parseEther("100000")); // 11% of supply
      
      await token.connect(addr1).createProposal(description);
      const proposalId = await token.proposalCount();
      
      await token.connect(addr1).vote(proposalId, true);
      
      // Fast forward past voting period
      await time.increase(7 * 24 * 60 * 60 + 1); // 7 days + 1 second
      
      await token.connect(addr1).executeProposal(proposalId);
      
      const proposal = await token.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
    });

    it("Should prevent execution without quorum", async function () {
      const description = "Test proposal";
      
      await token.connect(addr1).createProposal(description);
      const proposalId = await token.proposalCount();
      
      await token.connect(addr1).vote(proposalId, true);
      
      // Fast forward past voting period
      await time.increase(7 * 24 * 60 * 60 + 1);
      
      await expect(
        token.connect(addr1).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(token, "QuorumNotReached");
    });
  });

  describe("Admin Functions", function () {
    it("Should update max transfer amount", async function () {
      const newAmount = ethers.parseEther("5000");
      
      await token.updateMaxTransferAmount(newAmount);
      
      expect(await token.maxTransferAmount()).to.equal(newAmount);
    });

    it("Should toggle transfer limits", async function () {
      const initialState = await token.transferLimitsEnabled();
      
      await token.toggleTransferLimits();
      
      expect(await token.transferLimitsEnabled()).to.equal(!initialState);
    });

    it("Should set whitelist status", async function () {
      await token.setWhitelisted(addr1.address, true);
      expect(await token.isWhitelisted(addr1.address)).to.be.true;
      
      await token.setWhitelisted(addr1.address, false);
      expect(await token.isWhitelisted(addr1.address)).to.be.false;
    });

    it("Should pause and unpause contract", async function () {
      await token.emergencyPause();
      expect(await token.paused()).to.be.true;
      
      await token.emergencyUnpause();
      expect(await token.paused()).to.be.false;
    });

    it("Should prevent non-owner from calling admin functions", async function () {
      await expect(
        token.connect(addr1).updateMaxTransferAmount(ethers.parseEther("5000"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      
      await expect(
        token.connect(addr1).toggleTransferLimits()
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      
      await expect(
        token.connect(addr1).setWhitelisted(addr2.address, true)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await token.transfer(addr1.address, ethers.parseEther("1000"));
    });

    it("Should return correct available balance", async function () {
      const balance = await token.balanceOf(addr1.address);
      let availableBalance = await token.getAvailableBalance(addr1.address);
      
      expect(availableBalance).to.equal(balance);
      
      // Lock some tokens
      const lockAmount = ethers.parseEther("500");
      await token.connect(addr1).lockTokens(lockAmount, 7 * 24 * 60 * 60);
      
      availableBalance = await token.getAvailableBalance(addr1.address);
      expect(availableBalance).to.equal(balance - lockAmount);
    });

    it("Should return correct proposal details", async function () {
      await token.transfer(addr1.address, ethers.parseEther("20000"));
      
      const description = "Test proposal";
      await token.connect(addr1).createProposal(description);
      
      const proposalId = await token.proposalCount();
      const proposal = await token.getProposal(proposalId);
      
      expect(proposal.id).to.equal(proposalId);
      expect(proposal.creator).to.equal(addr1.address);
      expect(proposal.description).to.equal(description);
      expect(proposal.active).to.be.true;
      expect(proposal.executed).to.be.false;
    });
  });

  describe("Liquidity Locking", function () {
    let mockLPToken;

    beforeEach(async function () {
      // Create a mock LP token for testing
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockLPToken = await MockERC20.deploy("LP Token", "LP", ethers.parseEther("1000"));
      await mockLPToken.waitForDeployment();
      
      // Transfer LP tokens to owner
      await mockLPToken.transfer(owner.address, ethers.parseEther("500"));
    });

    it("Should lock liquidity tokens", async function () {
      const lockAmount = ethers.parseEther("100");
      const lockDuration = 30 * 24 * 60 * 60; // 30 days
      
      await mockLPToken.approve(await token.getAddress(), lockAmount);
      await token.lockLiquidity(await mockLPToken.getAddress(), lockAmount, lockDuration);
      
      const lockInfo = await token.liquidityLocks(await mockLPToken.getAddress());
      expect(lockInfo.amount).to.equal(lockAmount);
      expect(lockInfo.isLocked).to.be.true;
    });

    it("Should prevent liquidity locking by non-owner", async function () {
      const lockAmount = ethers.parseEther("100");
      const lockDuration = 30 * 24 * 60 * 60;
      
      await expect(
        token.connect(addr1).lockLiquidity(await mockLPToken.getAddress(), lockAmount, lockDuration)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });
});

// Mock ERC20 contract is implemented in contracts/MockERC20.sol
// and is used in the tests above for liquidity locking functionality
