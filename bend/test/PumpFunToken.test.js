const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunToken", function () {
  let token;
  let factory;
  let airdrop;
  let deployer, creator, user1, user2, user3;
  const INITIAL_SUPPLY = 1000000;
  const DECIMALS = 18;
  const MIN_LOCK_DURATION = 86400; // 1 day
  const MAX_LOCK_DURATION = 31536000; // 365 days
  const TRANSFER_COOLDOWN = 3600; // 1 hour

  async function deployTokenFixture() {
    [deployer, creator, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy Airdrop contract first
    const PumpFunGovernanceAirdrop = await ethers.getContractFactory("PumpFunGovernanceAirdrop");
    airdrop = await PumpFunGovernanceAirdrop.deploy(deployer.address);
    await airdrop.waitForDeployment();
    
    // Deploy Factory
    const PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
    factory = await PumpFunFactoryLite.deploy();
    await factory.waitForDeployment();
    
    // Set airdrop in factory
    await factory.setAirdropManager(await airdrop.getAddress());
    
    // Deploy token
    const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
    token = await PumpFunToken.deploy(
      "TestToken", 
      "TEST", 
      INITIAL_SUPPLY, 
      creator.address, 
      await factory.getAddress()
    );
    await token.waitForDeployment();
    
    return { token, factory, airdrop, deployer, creator, user1, user2, user3 };
  }

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      expect(await token.name()).to.equal("TestToken");
      expect(await token.symbol()).to.equal("TEST");
      expect(await token.decimals()).to.equal(DECIMALS);
      expect(await token.owner()).to.equal(creator.address);
    });

    it("Should set correct initial supply and distribution", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const expectedTotalSupply = ethers.parseUnits(INITIAL_SUPPLY.toString(), DECIMALS);
      
      expect(await token.totalSupply()).to.equal(expectedTotalSupply);
      
      // Creator gets 10%
      const creatorBalance = await token.balanceOf(creator.address);
      const expectedCreatorAmount = expectedTotalSupply * BigInt(10) / BigInt(100);
      expect(creatorBalance).to.equal(expectedCreatorAmount);
      
      // Contract gets 90% (20% liquidity + 70% community)
      const contractBalance = await token.balanceOf(await token.getAddress());
      const expectedContractAmount = expectedTotalSupply * BigInt(90) / BigInt(100);
      expect(contractBalance).to.equal(expectedContractAmount);
    });

    it("Should revert with invalid parameters", async function () {
      const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
      const { factory } = await loadFixture(deployTokenFixture);
      
      // Empty name
      await expect(
        PumpFunToken.deploy("", "TEST", INITIAL_SUPPLY, creator.address, await factory.getAddress())
      ).to.be.revertedWithCustomError(token, "PumpFunToken__InvalidName");
      
      // Empty symbol
      await expect(
        PumpFunToken.deploy("Test", "", INITIAL_SUPPLY, creator.address, await factory.getAddress())
      ).to.be.revertedWithCustomError(token, "PumpFunToken__InvalidSymbol");
      
      // Zero supply
      await expect(
        PumpFunToken.deploy("Test", "TEST", 0, creator.address, await factory.getAddress())
      ).to.be.revertedWithCustomError(token, "PumpFunToken__ZeroAmount");
      
      // Zero creator address
      await expect(
        PumpFunToken.deploy("Test", "TEST", INITIAL_SUPPLY, ethers.ZeroAddress, await factory.getAddress())
      ).to.be.revertedWithCustomError(token, "PumpFunToken__ZeroAddress");
    });
  });

  describe("ERC20 Functionality", function () {
    it("Should handle transfers correctly", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const transferAmount = ethers.parseUnits("1000", DECIMALS);
      
      await token.connect(creator).transfer(user1.address, transferAmount);
      expect(await token.balanceOf(user1.address)).to.equal(transferAmount);
    });

    it("Should handle approvals correctly", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const approveAmount = ethers.parseUnits("1000", DECIMALS);
      
      await token.connect(creator).approve(user1.address, approveAmount);
      expect(await token.allowance(creator.address, user1.address)).to.equal(approveAmount);
    });

    it("Should handle transferFrom correctly", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseUnits("1000", DECIMALS);
      
      await token.connect(creator).approve(user1.address, amount);
      await token.connect(user1).transferFrom(creator.address, user2.address, amount);
      
      expect(await token.balanceOf(user2.address)).to.equal(amount);
      expect(await token.allowance(creator.address, user1.address)).to.equal(0);
    });
  });

  describe("Token Locking", function () {
    it("Should allow users to lock tokens", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const lockAmount = ethers.parseUnits("1000", DECIMALS);
      const lockDuration = MIN_LOCK_DURATION;
      
      await expect(token.connect(creator).lockTokens(lockAmount, lockDuration))
        .to.emit(token, "TokensLocked")
        .withArgs(creator.address, lockAmount, (await time.latest()) + lockDuration + 1);
      
      const lockInfo = await token.getLockedTokens(creator.address);
      expect(lockInfo[0]).to.equal(lockAmount); // amount
      expect(lockInfo[2]).to.be.true; // isLocked
    });

    it("Should prevent locking with invalid duration", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const lockAmount = ethers.parseUnits("1000", DECIMALS);
      
      // Too short
      await expect(
        token.connect(creator).lockTokens(lockAmount, MIN_LOCK_DURATION - 1)
      ).to.be.revertedWithCustomError(token, "PumpFunToken__InvalidLockDuration");
      
      // Too long
      await expect(
        token.connect(creator).lockTokens(lockAmount, MAX_LOCK_DURATION + 1)
      ).to.be.revertedWithCustomError(token, "PumpFunToken__InvalidLockDuration");
    });

    it("Should prevent double locking", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const lockAmount = ethers.parseUnits("1000", DECIMALS);
      
      await token.connect(creator).lockTokens(lockAmount, MIN_LOCK_DURATION);
      
      await expect(
        token.connect(creator).lockTokens(lockAmount, MIN_LOCK_DURATION)
      ).to.be.revertedWithCustomError(token, "PumpFunToken__TokensAlreadyLocked");
    });

    it("Should allow unlocking after expiry", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const lockAmount = ethers.parseUnits("1000", DECIMALS);
      const lockDuration = MIN_LOCK_DURATION;
      
      await token.connect(creator).lockTokens(lockAmount, lockDuration);
      
      // Try to unlock before expiry
      await expect(
        token.connect(creator).unlockTokens()
      ).to.be.revertedWithCustomError(token, "PumpFunToken__LockNotExpired");
      
      // Fast forward time
      await time.increase(lockDuration + 1);
      
      await expect(token.connect(creator).unlockTokens())
        .to.emit(token, "TokensUnlocked")
        .withArgs(creator.address, lockAmount);
      
      const lockInfo = await token.getLockedTokens(creator.address);
      expect(lockInfo[2]).to.be.false; // isLocked
    });
  });

  describe("Transfer Restrictions", function () {
    it("Should enforce max transfer amount", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const maxTransfer = await token.maxTransferAmount();
      
      // This should work
      await token.connect(creator).transfer(user1.address, maxTransfer);
      
      // This should fail
      await expect(
        token.connect(creator).transfer(user1.address, maxTransfer + BigInt(1))
      ).to.be.revertedWithCustomError(token, "PumpFunToken__ExceedsMaxTransferAmount");
    });

    it("Should enforce max holding amount", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const maxHolding = await token.maxHolding();
      
      // Transfer close to max holding
      await token.connect(creator).transfer(user1.address, maxHolding);
      
      // Try to exceed max holding
      await expect(
        token.connect(creator).transfer(user1.address, BigInt(1))
      ).to.be.revertedWithCustomError(token, "PumpFunToken__ExceedsMaxHolding");
    });

    it("Should enforce transfer cooldown", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const transferAmount = ethers.parseUnits("100", DECIMALS);
      
      await token.connect(creator).transfer(user1.address, transferAmount);
      
      // Immediate second transfer should fail
      await expect(
        token.connect(creator).transfer(user2.address, transferAmount)
      ).to.be.revertedWithCustomError(token, "PumpFunToken__TransferLocked");
      
      // After cooldown, should work
      await time.increase(TRANSFER_COOLDOWN + 1);
      await token.connect(creator).transfer(user2.address, transferAmount);
    });

    it("Should allow whitelisted addresses to bypass restrictions", async function () {
      const { token, creator, factory } = await loadFixture(deployTokenFixture);
      const maxTransfer = await token.maxTransferAmount();
      const largeAmount = maxTransfer * BigInt(2);
      
      // Factory should be whitelisted by default and can make large transfers
      const factoryAddress = await factory.getAddress();
      expect(await token.isWhitelisted(factoryAddress)).to.be.true;
      
      // Set user1 as whitelisted
      await token.connect(creator).setWhitelisted(user1.address, true);
      
      // Transfer large amount to whitelisted user
      await token.connect(creator).transfer(user1.address, largeAmount);
      expect(await token.balanceOf(user1.address)).to.equal(largeAmount);
    });
  });

  describe("Burning", function () {
    it("Should allow token burning", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseUnits("1000", DECIMALS);
      const initialBalance = await token.balanceOf(creator.address);
      const initialSupply = await token.totalSupply();
      
      await token.connect(creator).burn(burnAmount);
      
      expect(await token.balanceOf(creator.address)).to.equal(initialBalance - burnAmount);
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should allow burning from approved amount", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseUnits("1000", DECIMALS);
      
      await token.connect(creator).approve(user1.address, burnAmount);
      await token.connect(user1).burnFrom(creator.address, burnAmount);
      
      expect(await token.allowance(creator.address, user1.address)).to.equal(0);
    });
  });

  describe("Pausable Functionality", function () {
    it("Should allow owner to pause and unpause", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      
      await token.connect(creator).emergencyPause();
      expect(await token.paused()).to.be.true;
      
      // Transfers should fail when paused
      await expect(
        token.connect(creator).transfer(user1.address, ethers.parseUnits("100", DECIMALS))
      ).to.be.revertedWith("Pausable: paused");
      
      await token.connect(creator).emergencyUnpause();
      expect(await token.paused()).to.be.false;
      
      // Transfers should work again
      await token.connect(creator).transfer(user1.address, ethers.parseUnits("100", DECIMALS));
    });

    it("Should prevent non-owner from pausing", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(user1).emergencyPause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update max transfer amount", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const newAmount = ethers.parseUnits("5000", DECIMALS);
      
      await expect(token.connect(creator).setMaxTransferAmount(newAmount))
        .to.emit(token, "MaxTransferAmountUpdated");
      
      expect(await token.maxTransferAmount()).to.equal(newAmount);
    });

    it("Should allow owner to update max holding", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const newAmount = ethers.parseUnits("10000", DECIMALS);
      
      await expect(token.connect(creator).setMaxHolding(newAmount))
        .to.emit(token, "MaxHoldingUpdated");
      
      expect(await token.maxHolding()).to.equal(newAmount);
    });

    it("Should allow owner to toggle transfer limits", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      
      await token.connect(creator).setTransferLimitsEnabled(false);
      expect(await token.transferLimitsEnabled()).to.be.false;
      
      await token.connect(creator).setTransferLimitsEnabled(true);
      expect(await token.transferLimitsEnabled()).to.be.true;
    });

    it("Should prevent non-owner from calling admin functions", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(user1).setMaxTransferAmount(ethers.parseUnits("1000", DECIMALS))
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        token.connect(user1).setTransferLimitsEnabled(false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Stability Mechanisms", function () {
    it("Should allow stability minting when conditions are met", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const mintAmount = ethers.parseUnits("1000", DECIMALS);
      const targetPrice = await token.targetPrice();
      const currentPrice = targetPrice + BigInt(1); // Above target
      
      const initialSupply = await token.totalSupply();
      
      await expect(
        token.connect(creator).stabilityMint(mintAmount, currentPrice)
      ).to.emit(token, "StabilityMint")
      .withArgs(mintAmount, currentPrice);
      
      expect(await token.totalSupply()).to.equal(initialSupply + mintAmount);
    });

    it("Should allow stability burning when conditions are met", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseUnits("1000", DECIMALS);
      const targetPrice = await token.targetPrice();
      const currentPrice = targetPrice - BigInt(1); // Below target
      
      const initialContractBalance = await token.balanceOf(await token.getAddress());
      
      await expect(
        token.connect(creator).stabilityBurn(burnAmount, currentPrice)
      ).to.emit(token, "StabilityBurn")
      .withArgs(burnAmount, currentPrice);
      
      expect(await token.balanceOf(await token.getAddress())).to.equal(initialContractBalance - burnAmount);
    });

    it("Should prevent stability operations when disabled", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseUnits("1000", DECIMALS);
      const price = ethers.parseUnits("1", DECIMALS);
      
      await token.connect(creator).setMintingEnabled(false);
      await expect(
        token.connect(creator).stabilityMint(amount, price + BigInt(1))
      ).to.be.revertedWithCustomError(token, "PumpFunToken__MintingPaused");
      
      await token.connect(creator).setBurningEnabled(false);
      await expect(
        token.connect(creator).stabilityBurn(amount, price - BigInt(1))
      ).to.be.revertedWithCustomError(token, "PumpFunToken__BurningPaused");
    });
  });

  describe("Contract Interaction", function () {
    it("Should allow contract owner to approve spenders", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const approveAmount = ethers.parseUnits("1000", DECIMALS);
      
      await expect(
        token.connect(creator).approveContractSpender(user1.address, approveAmount)
      ).to.emit(token, "ContractApprovedSpender")
      .withArgs(user1.address, approveAmount);
      
      expect(await token.allowance(await token.getAddress(), user1.address)).to.equal(approveAmount);
    });

    it("Should prevent approving zero address or zero amount", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseUnits("1000", DECIMALS);
      
      await expect(
        token.connect(creator).approveContractSpender(ethers.ZeroAddress, amount)
      ).to.be.revertedWithCustomError(token, "PumpFunToken__ZeroAddress");
      
      await expect(
        token.connect(creator).approveContractSpender(user1.address, 0)
      ).to.be.revertedWithCustomError(token, "PumpFunToken__ZeroAmount");
    });
  });

  describe("View Functions", function () {
    it("Should return correct available balance", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const lockAmount = ethers.parseUnits("1000", DECIMALS);
      const totalBalance = await token.balanceOf(creator.address);
      
      // Before locking
      expect(await token.getAvailableBalance(creator.address)).to.equal(totalBalance);
      
      // After locking
      await token.connect(creator).lockTokens(lockAmount, MIN_LOCK_DURATION);
      expect(await token.getAvailableBalance(creator.address)).to.equal(totalBalance - lockAmount);
      
      // After unlock time passes
      await time.increase(MIN_LOCK_DURATION + 1);
      expect(await token.getAvailableBalance(creator.address)).to.equal(totalBalance);
    });

    it("Should return correct lock information", async function () {
      const { token, creator } = await loadFixture(deployTokenFixture);
      const lockAmount = ethers.parseUnits("1000", DECIMALS);
      const lockDuration = MIN_LOCK_DURATION;
      
      // Before locking
      let lockInfo = await token.getLockedTokens(creator.address);
      expect(lockInfo[2]).to.be.false; // isLocked
      
      // After locking
      await token.connect(creator).lockTokens(lockAmount, lockDuration);
      lockInfo = await token.getLockedTokens(creator.address);
      expect(lockInfo[0]).to.equal(lockAmount); // amount
      expect(lockInfo[2]).to.be.true; // isLocked
    });
  });
});

