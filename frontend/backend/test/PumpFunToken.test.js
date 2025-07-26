const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunToken", function () {
  let pumpFunToken, mockFactory, mockAirdrop, owner, creator, addr1, addr2;
  const TOKEN_NAME = "PumpFunToken";
  const TOKEN_SYMBOL = "PFT";
  const LOCK_DURATION = 7 * 24 * 3600; // 7 days

  async function deployTokenFixture() {
    [owner, creator, addr1, addr2] = await ethers.getSigners();

    // Deploy mock airdrop contract
    const MockAirdrop = await ethers.getContractFactory("ERC20Mock");
    const initialBalance = ethers.parseEther("1000");
    mockAirdrop = await MockAirdrop.deploy("MockAirdrop", "MA", initialBalance);
    await mockAirdrop.waitForDeployment();

    // Deploy mock factory
    const MockFactory = await ethers.getContractFactory("MockFactory");
    mockFactory = await MockFactory.deploy(await mockAirdrop.getAddress());
    await mockFactory.waitForDeployment();

    // Deploy PumpFunToken with creator and factory
    const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
    pumpFunToken = await PumpFunToken.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      ethers.parseUnits("1000000", 0), // 1M tokens without decimals
      creator.address,
      await mockFactory.getAddress()
    );
    await pumpFunToken.waitForDeployment();

    console.log("PumpFunToken stats : ", TOKEN_NAME, TOKEN_SYMBOL,
      await pumpFunToken.totalSupply().then(supply => supply.toString()),
      "Creator:", creator.address,
      "Factory:", await mockFactory.getAddress(),
      "Deployment Address:", await pumpFunToken.getAddress()
    );

    return { pumpFunToken, mockFactory, mockAirdrop, owner, creator, addr1, addr2 };
  }

  beforeEach(async function () {
    ({ pumpFunToken, mockFactory, mockAirdrop, owner, creator, addr1, addr2 } = await loadFixture(deployTokenFixture));
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await pumpFunToken.name()).to.equal(TOKEN_NAME);
      expect(await pumpFunToken.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should set the correct owner", async function () {
      expect(await pumpFunToken.owner()).to.equal(creator.address);
    });

    it("Should distribute initial supply correctly", async function () {
      const totalSupply = await pumpFunToken.totalSupply();
      const creatorBalance = await pumpFunToken.balanceOf(creator.address);
      const contractBalance = await pumpFunToken.balanceOf(pumpFunToken.getAddress());

      // Creator should have 10% of total supply
      const expectedCreatorBalance = totalSupply * 10n / 100n;
      expect(creatorBalance).to.equal(expectedCreatorBalance);

      // Contract should have 90% (20% + 40% + 30%)
      expect(contractBalance).to.be.gt(0);
      const expectedContractBalance = totalSupply * 90n / 100n;
      expect(contractBalance).to.equal(expectedContractBalance);
    });

    it("Should revert with invalid parameters", async function () {
      const PumpFunToken = await ethers.getContractFactory("PumpFunToken");

      // Invalid name
      await expect(
        PumpFunToken.deploy("", TOKEN_SYMBOL, 1000000, creator.address, await mockFactory.getAddress())
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__InvalidName");

      // Invalid symbol
      await expect(
        PumpFunToken.deploy(TOKEN_NAME, "", 1000000, creator.address, await mockFactory.getAddress())
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__InvalidSymbol");

      // Zero supply
      await expect(
        PumpFunToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, 0, creator.address, await mockFactory.getAddress())
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__ZeroAmount");

      // Zero address creator — this fails due to OpenZeppelin Ownable
      await expect(
        PumpFunToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, 1000000, ethers.ZeroAddress, await mockFactory.getAddress())
      ).to.be.revertedWithCustomError(PumpFunToken, "OwnableInvalidOwner");

      // Zero address factory
      await expect(
        PumpFunToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, 1000000, creator.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__ZeroAddress");
    });
  });

  describe("Token Locking", function () {
    it("Should allow users to lock tokens", async function () {
      const lockAmount = ethers.parseEther("1000");
      await pumpFunToken.connect(creator).lockTokens(lockAmount, LOCK_DURATION);

      const lockInfo = await pumpFunToken.getLockedTokens(creator.address);
      expect(lockInfo.amount).to.equal(lockAmount);
      expect(lockInfo.isLocked).to.be.true;
      expect(lockInfo.unlockTime).to.be.gt(await time.latest());
    });

    it("Should prevent locking with invalid duration", async function () {
      const lockAmount = ethers.parseEther("1000");
      const shortDuration = 3600; // 1 hour (less than minimum 1 day)
      const longDuration = 366 * 24 * 3600; // More than 365 days

      await expect(
        pumpFunToken.connect(creator).lockTokens(lockAmount, shortDuration)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__InvalidLockDuration");

      await expect(
        pumpFunToken.connect(creator).lockTokens(lockAmount, longDuration)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__InvalidLockDuration");
    });

    it("Should prevent locking zero amount", async function () {
      await expect(
        pumpFunToken.connect(creator).lockTokens(0, LOCK_DURATION)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__ZeroAmount");
    });

    it("Should prevent locking more tokens than balance", async function () {
      const balance = await pumpFunToken.balanceOf(creator.address);
      const excessAmount = balance + ethers.parseEther("1");

      await expect(
        pumpFunToken.connect(creator).lockTokens(excessAmount, LOCK_DURATION)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__InsufficientBalance");
    });

    it("Should prevent double locking", async function () {
      const lockAmount = ethers.parseEther("1000");
      await pumpFunToken.connect(creator).lockTokens(lockAmount, LOCK_DURATION);

      await expect(
        pumpFunToken.connect(creator).lockTokens(lockAmount, LOCK_DURATION)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__TokensAlreadyLocked");
    });

    it("Should allow unlocking after duration", async function () {
      const lockAmount = ethers.parseEther("1000");
      await pumpFunToken.connect(creator).lockTokens(lockAmount, LOCK_DURATION);

      // Fast forward time
      await time.increase(LOCK_DURATION + 1);

      await expect(pumpFunToken.connect(creator).unlockTokens())
        .to.emit(pumpFunToken, "TokensUnlocked")
        .withArgs(creator.address, lockAmount);

      const lockInfo = await pumpFunToken.getLockedTokens(creator.address);
      expect(lockInfo.isLocked).to.be.false;
    });

    it("Should prevent early unlocking", async function () {
      const lockAmount = ethers.parseEther("1000");
      await pumpFunToken.connect(creator).lockTokens(lockAmount, LOCK_DURATION);

      const lockInfo = await pumpFunToken.getLockedTokens(creator.address);

      await expect(
        pumpFunToken.connect(creator).unlockTokens()
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__LockNotExpired");
    });
  });

  describe("Transfer Restrictions", function () {
    it("Should enforce max transfer amount", async function () {
      const maxTransferAmount = await pumpFunToken.maxTransferAmount();
      const excessAmount = maxTransferAmount + 1n;

      await expect(
        pumpFunToken.connect(creator).transfer(addr1.address, excessAmount)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__ExceedsMaxTransferAmount");
    });

    it("Should enforce max holding limit", async function () {
      const maxHolding = await pumpFunToken.maxHolding();

      await pumpFunToken.connect(creator).setTransferLimitsEnabled(false);
      await pumpFunToken.connect(creator).transfer(addr1.address, maxHolding);
      await pumpFunToken.connect(creator).setTransferLimitsEnabled(true);

      await expect(
        pumpFunToken.connect(creator).transfer(addr1.address, 1n)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__ExceedsMaxHolding");
    });

    it("Should allow whitelisted addresses to bypass restrictions", async function () {
      const maxTransferAmount = await pumpFunToken.maxTransferAmount();
      const excessAmount = maxTransferAmount + 1n;

      // Whitelist addr1
      await pumpFunToken.connect(creator).setWhitelisted(addr1.address, true);

      // Transfer to whitelisted address should work
      await pumpFunToken.connect(creator).transfer(addr1.address, excessAmount);

      expect(await pumpFunToken.balanceOf(addr1.address)).to.equal(excessAmount);
    });

    it("Should enforce transfer cooldown", async function () {
      const transferAmount = ethers.parseEther("100");

      // First transfer should succeed
      await pumpFunToken.connect(creator).transfer(addr1.address, transferAmount);

      // Second transfer within cooldown should fail
      await expect(
        pumpFunToken.connect(creator).transfer(addr2.address, transferAmount)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__TransferLocked");

      // Fast forward past cooldown
      await time.increase(3601); // 1 hour + 1 second

      // Now transfer should succeed
      await pumpFunToken.connect(creator).transfer(addr2.address, transferAmount);
      expect(await pumpFunToken.balanceOf(addr2.address)).to.equal(transferAmount);
    });

    it("Should prevent transfers of locked tokens", async function () {
      const lockAmount = ethers.parseEther("1000");
      const transferAmount = ethers.parseEther("500");

      await pumpFunToken.connect(creator).lockTokens(lockAmount, LOCK_DURATION);

      await expect(
        pumpFunToken.connect(creator).transfer(addr1.address, transferAmount)
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__TransferLocked");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update max transfer amount", async function () {
      const newMaxTransfer = ethers.parseEther("2000");

      await expect(pumpFunToken.connect(creator).setMaxTransferAmount(newMaxTransfer))
        .to.emit(pumpFunToken, "MaxTransferAmountUpdated");

      expect(await pumpFunToken.maxTransferAmount()).to.equal(newMaxTransfer);
    });

    it("Should allow owner to update max holding", async function () {
      const newMaxHolding = ethers.parseEther("10000");

      await expect(pumpFunToken.connect(creator).setMaxHolding(newMaxHolding))
        .to.emit(pumpFunToken, "MaxHoldingUpdated");

      expect(await pumpFunToken.maxHolding()).to.equal(newMaxHolding);
    });

    it("Should allow owner to toggle transfer limits", async function () {
      await pumpFunToken.connect(creator).setTransferLimitsEnabled(false);
      expect(await pumpFunToken.transferLimitsEnabled()).to.be.false;

      await pumpFunToken.connect(creator).setTransferLimitsEnabled(true);
      expect(await pumpFunToken.transferLimitsEnabled()).to.be.true;
    });

    it("Should allow owner to pause/unpause contract", async function () {
      await pumpFunToken.connect(creator).emergencyPause();

      await expect(
        pumpFunToken.connect(creator).transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(pumpFunToken, "EnforcedPause");

      await pumpFunToken.connect(creator).emergencyUnpause();

      // Transfers should work again
      await pumpFunToken.connect(creator).transfer(addr1.address, ethers.parseEther("100"));
    });

    it("Should prevent non-owners from accessing admin functions", async function () {
      await expect(
        pumpFunToken.connect(addr1).setMaxTransferAmount(ethers.parseEther("2000"))
      ).to.be.revertedWithCustomError(pumpFunToken, "OwnableUnauthorizedAccount");

      await expect(
        pumpFunToken.connect(addr1).emergencyPause()
      ).to.be.revertedWithCustomError(pumpFunToken, "OwnableUnauthorizedAccount");
    });
  });

  describe("Stability Mechanisms", function () {
    it("Should allow owner to stability mint when conditions are met", async function () {
      const mintAmount = ethers.parseEther("10");
      const currentPrice = ethers.parseEther("2"); // Higher than target price
      
      // First burn some tokens to make room for minting and get below stability threshold
      const burnAmount = ethers.parseEther("500000"); // Burn enough to get below threshold
      await pumpFunToken.connect(creator).stabilityBurn(burnAmount, ethers.parseEther("0.5"));

      await expect(pumpFunToken.connect(creator).stabilityMint(mintAmount, currentPrice))
        .to.emit(pumpFunToken, "StabilityMint")
        .withArgs(mintAmount, currentPrice);

      // Contract balance should increase
      const contractBalance = await pumpFunToken.balanceOf(await pumpFunToken.getAddress());
      expect(contractBalance).to.be.gt(0);
    });

    it("Should allow owner to stability burn when conditions are met", async function () {
      const burnAmount = ethers.parseEther("1000");
      const currentPrice = ethers.parseEther("0.5"); // Lower than target price

      await expect(pumpFunToken.connect(creator).stabilityBurn(burnAmount, currentPrice))
        .to.emit(pumpFunToken, "StabilityBurn")
        .withArgs(burnAmount, currentPrice);
    });

    it("Should prevent minting when disabled", async function () {
      await pumpFunToken.connect(creator).setMintingEnabled(false);

      await expect(
        pumpFunToken.connect(creator).stabilityMint(
          ethers.parseEther("1000"),
          ethers.parseEther("2")
        )
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__MintingPaused");
    });

    it("Should prevent burning when disabled", async function () {
      await pumpFunToken.connect(creator).setBurningEnabled(false);

      await expect(
        pumpFunToken.connect(creator).stabilityBurn(
          ethers.parseEther("1000"),
          ethers.parseEther("0.5")
        )
      ).to.be.revertedWithCustomError(pumpFunToken, "PumpFunToken__BurningPaused");
    });
  });

  describe("View Functions", function () {
    it("Should return correct available balance", async function () {
      const lockAmount = ethers.parseEther("1000");
      const totalBalance = await pumpFunToken.balanceOf(creator.address);

      // Before locking
      expect(await pumpFunToken.getAvailableBalance(creator.address)).to.equal(totalBalance);

      // After locking
      await pumpFunToken.connect(creator).lockTokens(lockAmount, LOCK_DURATION);
      const availableBalance = await pumpFunToken.getAvailableBalance(creator.address);
      expect(availableBalance).to.equal(totalBalance - lockAmount);
    });

    it("Should return correct pool balances", async function () {
      const [liquidityBalance, dexBalance] = await pumpFunToken.getPoolBalances();
      const totalSupply = await pumpFunToken.totalSupply();

      expect(liquidityBalance).to.equal(totalSupply * 20n / 100n);
      expect(dexBalance).to.equal(totalSupply * 40n / 100n);
    });
  });
});

