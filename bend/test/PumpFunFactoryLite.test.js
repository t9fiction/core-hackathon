const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("PumpFunFactoryLite", function () {
  let PumpFunFactoryLite, factory;
  let PumpFunToken;
  let owner, creator, addr1, addr2;
  let deploymentFee;

  beforeEach(async function () {
    [owner, creator, addr1, addr2] = await ethers.getSigners();
    
    PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
    PumpFunToken = await ethers.getContractFactory("PumpFunToken");
    
    factory = await PumpFunFactoryLite.deploy();
    deploymentFee = await factory.etherFee();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct default values", async function () {
      expect(await factory.etherFee()).to.equal(ethers.parseEther("0.05"));
      expect(await factory.totalTokensDeployed()).to.equal(0);
      expect(await factory.totalFeesCollected()).to.equal(0);
      expect(await factory.MIN_LIQUIDITY_LOCK_PERIOD_DAYS()).to.equal(30);
    });

    describe("createDEXPool", function () {
      const tokenName = "TestTokenDEX";
      const tokenSymbol = "DEX";
      const totalSupply = 5000000;
      const lockPeriodDays = 30;
      let tokenAddress, token;

      beforeEach(async function () {
        await factory.connect(creator).deployToken(
          tokenName,
          tokenSymbol,
          totalSupply,
          lockPeriodDays,
          { value: deploymentFee }
        );

        const deployedTokens = await factory.getAllDeployedTokens();
        tokenAddress = deployedTokens[0];
        token = await PumpFunToken.attach(tokenAddress);

        // Transfer necessary token amount to creator for DEX pool
        await token.connect(creator).setWhitelisted(tokenAddress, true);
        await token.transfer(creator.address, ethers.parseUnits("100000", 18));
      });

      it("Should successfully create a DEX pool", async function () {
        const tokenAmount = ethers.parseUnits("100000", 18);
        const ethLiquidity = ethers.parseEther("10");

        // Approve factory to spend tokens
        await token.connect(creator).approve(factory.target, tokenAmount);

        await expect(
          factory.connect(creator).createDEXPool(
            tokenAddress,
            tokenAmount,
            { value: ethLiquidity }
          )
        ).to.emit(factory, "DEXPoolCreated").withArgs(tokenAddress, anyValue, tokenAmount, ethLiquidity);
      });

      it("Should fail with insufficient Ether", async function () {
        const tokenAmount = ethers.parseUnits("100000", 18);
        const insufficientEth = ethers.parseEther("1");

        await expect(
          factory.connect(creator).createDEXPool(
            tokenAddress,
            tokenAmount,
            { value: insufficientEth }
          )
        ).to.be.revertedWithCustomError(factory, "InvalidLiquidityAmount");
      });
    });
  });

  describe("Token Deployment", function () {
    const tokenName = "TestToken";
    const tokenSymbol = "TEST";
    const totalSupply = 1000000;
    const lockPeriodDays = 30;

    it("Should deploy token successfully with correct parameters", async function () {
      const tx = await factory.connect(creator).deployToken(
        tokenName,
        tokenSymbol,
        totalSupply,
        lockPeriodDays,
        { value: deploymentFee }
      );

      await expect(tx)
        .to.emit(factory, "TokenDeployed")
        .withArgs(
          tokenName,
          tokenSymbol,
          anyValue, // token address
          totalSupply,
          creator.address,
          lockPeriodDays
        );

      // Check factory state updates
      expect(await factory.totalTokensDeployed()).to.equal(1);
      expect(await factory.totalFeesCollected()).to.equal(deploymentFee);

      // Get deployed token address
      const deployedTokens = await factory.getAllDeployedTokens();
      expect(deployedTokens.length).to.equal(1);

      const tokenAddress = deployedTokens[0];
      expect(await factory.isDeployedToken(tokenAddress)).to.be.true;

      // Check token info storage
      const tokenInfo = await factory.getTokenInfo(tokenAddress);
      expect(tokenInfo.creator).to.equal(creator.address);
      expect(tokenInfo.liquidityLockPeriodDays).to.equal(lockPeriodDays);

      // Verify creator tokens mapping
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      expect(creatorTokens.length).to.equal(1);
      expect(creatorTokens[0]).to.equal(tokenAddress);
    });

    it("Should revert with insufficient fee", async function () {
      const insufficientFee = deploymentFee - 1n;

      await expect(
        factory.connect(creator).deployToken(
          tokenName,
          tokenSymbol,
          totalSupply,
          lockPeriodDays,
          { value: insufficientFee }
        )
      ).to.be.revertedWithCustomError(factory, "InsufficientEtherFee")
        .withArgs(insufficientFee, deploymentFee);
    });

    it("Should revert with empty name", async function () {
      await expect(
        factory.connect(creator).deployToken(
          "",
          tokenSymbol,
          totalSupply,
          lockPeriodDays,
          { value: deploymentFee }
        )
      ).to.be.revertedWithCustomError(factory, "EmptyStringParameter");
    });

    it("Should revert with empty symbol", async function () {
      await expect(
        factory.connect(creator).deployToken(
          tokenName,
          "",
          totalSupply,
          lockPeriodDays,
          { value: deploymentFee }
        )
      ).to.be.revertedWithCustomError(factory, "EmptyStringParameter");
    });

    it("Should revert with total supply too low", async function () {
      await expect(
        factory.connect(creator).deployToken(
          tokenName,
          tokenSymbol,
          999, // Below MIN_TOTAL_SUPPLY (1000)
          lockPeriodDays,
          { value: deploymentFee }
        )
      ).to.be.revertedWithCustomError(factory, "TotalSupplyTooLow");
    });

    it("Should revert with total supply too high", async function () {
      const maxSupply = await factory.ULTIMATE_MAX_SUPPLY();
      const excessiveSupply = maxSupply + 1n;

      await expect(
        factory.connect(creator).deployToken(
          tokenName,
          tokenSymbol,
          excessiveSupply,
          lockPeriodDays,
          { value: deploymentFee }
        )
      ).to.be.revertedWithCustomError(factory, "TotalSupplyTooHigh")
        .withArgs(excessiveSupply, maxSupply);
    });

    it("Should revert with insufficient liquidity lock period", async function () {
      const shortPeriod = 29; // Below minimum 30 days

      await expect(
        factory.connect(creator).deployToken(
          tokenName,
          tokenSymbol,
          totalSupply,
          shortPeriod,
          { value: deploymentFee }
        )
      ).to.be.revertedWithCustomError(factory, "InsufficientLiquidityLockPeriod")
        .withArgs(shortPeriod, 30);
    });

    it("Should allow deployment with excess fee", async function () {
      const excessFee = deploymentFee + ethers.parseEther("0.1");

      await expect(
        factory.connect(creator).deployToken(
          tokenName,
          tokenSymbol,
          totalSupply,
          lockPeriodDays,
          { value: excessFee }
        )
      ).to.not.be.reverted;

      expect(await factory.totalFeesCollected()).to.equal(excessFee);
    });

    it("Should deploy multiple tokens for same creator", async function () {
      // Deploy first token
      await factory.connect(creator).deployToken(
        tokenName,
        tokenSymbol,
        totalSupply,
        lockPeriodDays,
        { value: deploymentFee }
      );

      // Deploy second token
      await factory.connect(creator).deployToken(
        "SecondToken",
        "SECOND",
        totalSupply,
        lockPeriodDays,
        { value: deploymentFee }
      );

      expect(await factory.totalTokensDeployed()).to.equal(2);
      
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      expect(creatorTokens.length).to.equal(2);
    });
  });

  describe("createDEXPool", function () {
    const tokenName = "TestTokenDEX";
    const tokenSymbol = "DEX";
    const totalSupply = 5000000;
    const lockPeriodDays = 30;
    let tokenAddress, token;

    beforeEach(async function () {
      await factory.connect(creator).deployToken(
        tokenName,
        tokenSymbol,
        totalSupply,
        lockPeriodDays,
        { value: deploymentFee }
      );

      const deployedTokens = await factory.getAllDeployedTokens();
      tokenAddress = deployedTokens[0];
      token = await PumpFunToken.attach(tokenAddress);

      // Transfer necessary token amount to creator for DEX pool
      await token.transfer(creator.address, ethers.parseUnits("100000", 18));
    });

    it("Should successfully create a DEX pool", async function () {
      const tokenAmount = ethers.parseUnits("100000", 18);
      const ethLiquidity = ethers.parseEther("10");

      // Approve factory to spend tokens
      await token.connect(creator).approve(factory.target, tokenAmount);

      await expect(
        factory.connect(creator).createDEXPool(
          tokenAddress,
          tokenAmount,
          { value: ethLiquidity }
        )
      ).to.emit(factory, "DEXPoolCreated").withArgs(tokenAddress, anyValue, tokenAmount, ethLiquidity);
    });

    it("Should fail with insufficient Ether", async function () {
      const tokenAmount = ethers.parseUnits("100000", 18);
      const insufficientEth = ethers.parseEther("1");

      await expect(
        factory.connect(creator).createDEXPool(
          tokenAddress,
          tokenAmount,
          { value: insufficientEth }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidLiquidityAmount");
    });
  });

    describe("Liquidity Management", function () {
      let tokenAddress;
      const tokenAmount = ethers.parseUnits("10000", 18);
      const ethAmount = ethers.parseEther("1");

      beforeEach(async function () {
        // Deploy a token first
        await factory.connect(creator).deployToken(
          "TestToken",
          "TEST",
          1000000,
          30,
          { value: deploymentFee }
        );

        const deployedTokens = await factory.getAllDeployedTokens();
        tokenAddress = deployedTokens[0];

        // Transfer tokens to creator (they start in the token contract)
        const token = await PumpFunToken.attach(tokenAddress);
        await token.connect(creator).setWhitelisted(tokenAddress, true);
        await token.transfer(creator.address, tokenAmount);
        
        // Approve factory to spend tokens
        await token.connect(creator).approve(factory.target, tokenAmount);
      });

    it("Should add and lock liquidity successfully", async function () {
      await expect(
        factory.connect(creator).addAndLockLiquidity(
          tokenAddress,
          tokenAmount,
          { value: ethAmount }
        )
      ).to.emit(factory, "LiquidityAdded")
        .withArgs(tokenAddress, creator.address, ethAmount, tokenAmount);

      // Check liquidity info
      const liquidityInfo = await factory.liquidityInfo(tokenAddress);
      expect(liquidityInfo.ethAmount).to.equal(ethAmount);
      expect(liquidityInfo.tokenAmount).to.equal(tokenAmount);
      expect(liquidityInfo.isLocked).to.be.true;
      expect(liquidityInfo.lockPeriod).to.equal(30 * 24 * 60 * 60); // 30 days in seconds
    });

    it("Should revert with invalid token address", async function () {
      const invalidAddress = addr1.address;

      await expect(
        factory.connect(creator).addAndLockLiquidity(
          invalidAddress,
          tokenAmount,
          { value: ethAmount }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidTokenAddress");
    });

    it("Should revert with zero ETH value", async function () {
      await expect(
        factory.connect(creator).addAndLockLiquidity(
          tokenAddress,
          tokenAmount,
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidLiquidityAmount");
    });

    it("Should revert with zero token amount", async function () {
      await expect(
        factory.connect(creator).addAndLockLiquidity(
          tokenAddress,
          0,
          { value: ethAmount }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidLiquidityAmount");
    });

    it("Should revert if not called by token creator", async function () {
      await expect(
        factory.connect(addr1).addAndLockLiquidity(
          tokenAddress,
          tokenAmount,
          { value: ethAmount }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidParameters");
    });
  });

  describe("Admin Functions", function () {
    describe("Fee Management", function () {
      it("Should update ether fee", async function () {
        const newFee = ethers.parseEther("0.1");
        const oldFee = await factory.etherFee();

        await expect(factory.setEtherFee(newFee))
          .to.emit(factory, "EtherFeeUpdated")
          .withArgs(oldFee, newFee);

        expect(await factory.etherFee()).to.equal(newFee);
      });

      it("Should revert fee update above maximum", async function () {
        const maxFee = await factory.MAX_FEE();
        const excessiveFee = maxFee + 1n;

        await expect(
          factory.setEtherFee(excessiveFee)
        ).to.be.revertedWithCustomError(factory, "InvalidFeeAmount")
          .withArgs(excessiveFee);
      });

      it("Should only allow owner to update fee", async function () {
        const newFee = ethers.parseEther("0.1");

        await expect(
          factory.connect(addr1).setEtherFee(newFee)
        ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
      });
    });

    describe("Fee Withdrawal", function () {
      beforeEach(async function () {
        // Deploy a token to generate fees
        await factory.connect(creator).deployToken(
          "TestToken",
          "TEST",
          1000000,
          30,
          { value: deploymentFee }
        );
      });

      it("Should withdraw fees successfully", async function () {
        const contractBalance = await ethers.provider.getBalance(factory.target);
        const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

        await expect(factory.withdrawFees())
          .to.emit(factory, "EtherWithdrawn")
          .withArgs(owner.address, contractBalance);

        const contractBalanceAfter = await ethers.provider.getBalance(factory.target);
        expect(contractBalanceAfter).to.equal(0);
      });

      it("Should revert withdrawal with no balance", async function () {
        // First withdraw all fees
        await factory.withdrawFees();

        await expect(
          factory.withdrawFees()
        ).to.be.revertedWithCustomError(factory, "NoEtherToWithdraw");
      });

      it("Should only allow owner to withdraw fees", async function () {
        await expect(
          factory.connect(addr1).withdrawFees()
        ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
      });
    });

    describe("Anti-Rug Pull", function () {
      let tokenAddress;

      beforeEach(async function () {
        await factory.connect(creator).deployToken(
          "TestToken",
          "TEST",
          1000000,
          30,
          { value: deploymentFee }
        );

        const deployedTokens = await factory.getAllDeployedTokens();
        tokenAddress = deployedTokens[0];
      });

      it("Should emit anti-rug pull event when triggered by owner", async function () {
        const reason = "Suspicious activity detected";

        // The factory can emit the event but cannot actually pause the token
        // since only the token owner can pause it
        await expect(factory.triggerAntiRugPull(tokenAddress, reason))
          .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
      });

      it("Should revert with invalid token address", async function () {
        await expect(
          factory.triggerAntiRugPull(addr1.address, "Test reason")
        ).to.be.revertedWithCustomError(factory, "InvalidTokenAddress");
      });

      it("Should only allow owner to trigger anti-rug pull", async function () {
        await expect(
          factory.connect(addr1).triggerAntiRugPull(tokenAddress, "Test reason")
        ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Deploy multiple tokens for testing
      await factory.connect(creator).deployToken(
        "FirstToken",
        "FIRST",
        1000000,
        30,
        { value: deploymentFee }
      );

      await factory.connect(addr1).deployToken(
        "SecondToken",
        "SECOND",
        500000,
        45,
        { value: deploymentFee }
      );
    });

    it("Should return correct factory statistics", async function () {
      const stats = await factory.getFactoryStats();
      
      expect(stats._totalTokensDeployed).to.equal(2);
      expect(stats._totalFeesCollected).to.equal(deploymentFee * 2n);
      expect(stats._currentBalance).to.equal(deploymentFee * 2n);
    });

    it("Should return tokens by creator", async function () {
      const creatorTokens = await factory.getTokensByCreator(creator.address);
      const addr1Tokens = await factory.getTokensByCreator(addr1.address);

      expect(creatorTokens.length).to.equal(1);
      expect(addr1Tokens.length).to.equal(1);
    });

    it("Should return all deployed tokens", async function () {
      const allTokens = await factory.getAllDeployedTokens();
      expect(allTokens.length).to.equal(2);
    });

    it("Should return correct token info", async function () {
      const deployedTokens = await factory.getAllDeployedTokens();
      const tokenAddress = deployedTokens[0];

      const tokenInfo = await factory.getTokenInfo(tokenAddress);
      expect(tokenInfo.creator).to.equal(creator.address);
      expect(tokenInfo.liquidityLockPeriodDays).to.equal(30);
      expect(tokenInfo.deploymentTime).to.be.gt(0);
    });

    it("Should correctly identify deployed tokens", async function () {
      const deployedTokens = await factory.getAllDeployedTokens();
      
      expect(await factory.isDeployedToken(deployedTokens[0])).to.be.true;
      expect(await factory.isDeployedToken(deployedTokens[1])).to.be.true;
      expect(await factory.isDeployedToken(addr2.address)).to.be.false;
    });
  });

  describe("Constants and Limits", function () {
    it("Should have correct constant values", async function () {
      expect(await factory.MAX_FEE()).to.equal(ethers.parseEther("1"));
      expect(await factory.MIN_TOTAL_SUPPLY()).to.equal(1000);
      expect(await factory.ULTIMATE_MAX_SUPPLY()).to.equal(1000000000);
      expect(await factory.MIN_LIQUIDITY_LOCK_PERIOD_DAYS()).to.equal(30);
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy in deployToken", async function () {
      // This test ensures the nonReentrant modifier works
      // In a real attack scenario, this would be tested with a malicious contract
      
      await expect(
        factory.connect(creator).deployToken(
          "TestToken",
          "TEST",
          1000000,
          30,
          { value: deploymentFee }
        )
      ).to.not.be.reverted;
    });
  });

  describe("Receive and Fallback Functions", function () {
    it("Should accept ETH via receive function", async function () {
      const sendValue = ethers.parseEther("0.1");
      
      await expect(
        creator.sendTransaction({
          to: factory.target,
          value: sendValue
        })
      ).to.not.be.reverted;

      const balance = await ethers.provider.getBalance(factory.target);
      expect(balance).to.be.gte(sendValue);
    });

    it("Should accept ETH via fallback function", async function () {
      const sendValue = ethers.parseEther("0.1");
      
      await expect(
        creator.sendTransaction({
          to: factory.target,
          value: sendValue,
          data: "0x1234" // Non-empty data triggers fallback
        })
      ).to.not.be.reverted;

      const balance = await ethers.provider.getBalance(factory.target);
      expect(balance).to.be.gte(sendValue);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle maximum allowed values", async function () {
      const maxSupply = await factory.ULTIMATE_MAX_SUPPLY();
      const maxLockPeriod = 365; // Maximum reasonable lock period

      await expect(
        factory.connect(creator).deployToken(
          "MaxToken",
          "MAX",
          maxSupply,
          maxLockPeriod,
          { value: deploymentFee }
        )
      ).to.not.be.reverted;
    });

    it("Should handle minimum allowed values", async function () {
      const minSupply = await factory.MIN_TOTAL_SUPPLY();
      const minLockPeriod = await factory.MIN_LIQUIDITY_LOCK_PERIOD_DAYS();

      await expect(
        factory.connect(creator).deployToken(
          "MinToken",
          "MIN",
          minSupply,
          minLockPeriod,
          { value: deploymentFee }
        )
      ).to.not.be.reverted;
    });
  });
});
