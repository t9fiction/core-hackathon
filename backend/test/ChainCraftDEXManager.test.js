const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainCraftDEXManager Tests", function () {
  let dexManager;
  let factory;
  let token;
  let weth;
  let swapRouter;
  let owner, user1, user2, factoryOwner;

  // Mock data for testing
  const MOCK_ROUTE = "0x1234567890abcdef"; // Mock route data

  beforeEach(async function () {
    [owner, user1, user2, factoryOwner] = await ethers.getSigners();

    // Deploy mock WETH
    const WETHMock = await ethers.getContractFactory("WETHMock");
    weth = await WETHMock.deploy();
    await weth.waitForDeployment();

    // Deploy mock swap router (RouteProcessor7Mock)
    const SwapRouterMock = await ethers.getContractFactory("RouteProcessor7Mock");
    swapRouter = await SwapRouterMock.deploy();
    await swapRouter.waitForDeployment();

    // Deploy DEX Manager
    const DEXManager = await ethers.getContractFactory("ChainCraftDEXManager");
    dexManager = await DEXManager.connect(owner).deploy(
      await swapRouter.getAddress(),
      await weth.getAddress()
    );
    await dexManager.waitForDeployment();

    // Deploy factory
    const Factory = await ethers.getContractFactory("ChainCraftFactoryLite");
    factory = await Factory.connect(factoryOwner).deploy();
    await factory.waitForDeployment();

    // Connect factory to DEX manager
    await dexManager.connect(owner).setFactory(await factory.getAddress());
    await factory.connect(factoryOwner).setDEXManager(await dexManager.getAddress());

    // Deploy a test token through factory
    const deployTx = await factory.connect(user1).deployToken(
      "TestCoin",
      "TEST",
      1000000, // 1M tokens (not 1M * 18 decimals)
      { value: ethers.parseEther("0.05") }
    );

    const receipt = await deployTx.wait();
    const tokenDeployedEvent = receipt.logs.find(
      log => log.fragment && log.fragment.name === "TokenDeployed"
    );
    const tokenAddress = tokenDeployedEvent.args[2];

    token = await ethers.getContractAt("ChainCraftToken", tokenAddress);
  });

  describe("Deployment and Configuration", function () {
    it("Should deploy with correct parameters", async function () {
      expect(await dexManager.swapRouter()).to.equal(await swapRouter.getAddress());
      expect(await dexManager.WETH()).to.equal(await weth.getAddress());
      expect(await dexManager.owner()).to.equal(owner.address);
    });

    it("Should revert deployment with zero addresses", async function () {
      const DEXManager = await ethers.getContractFactory("ChainCraftDEXManager");
      
      await expect(
        DEXManager.deploy(ethers.ZeroAddress, await weth.getAddress())
      ).to.be.revertedWithCustomError(dexManager, "ChainCraftDEXManager__InvalidTokenAddress");

      await expect(
        DEXManager.deploy(await swapRouter.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(dexManager, "ChainCraftDEXManager__InvalidTokenAddress");
    });

    it("Should set factory address correctly", async function () {
      expect(await dexManager.factory()).to.equal(await factory.getAddress());
    });

    it("Should revert when non-owner tries to set factory", async function () {
      const newDEXManager = await (await ethers.getContractFactory("ChainCraftDEXManager"))
        .deploy(await swapRouter.getAddress(), await weth.getAddress());
      
      await expect(
        newDEXManager.connect(user1).setFactory(await factory.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Token Authorization", function () {
    it("Should authorize token by owner", async function () {
      await dexManager.connect(owner).authorizeToken(await token.getAddress());
      expect(await dexManager.authorizedTokens(await token.getAddress())).to.be.true;
    });

    it("Should authorize token from factory", async function () {
      await factory.connect(user1).authorizeDEXTrading(await token.getAddress());
      expect(await dexManager.authorizedTokens(await token.getAddress())).to.be.true;
    });

    it("Should revert authorization with zero address", async function () {
      await expect(
        dexManager.connect(owner).authorizeToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(dexManager, "ChainCraftDEXManager__InvalidTokenAddress");
    });

    it("Should revert factory authorization from non-factory", async function () {
      await expect(
        dexManager.connect(user1).authorizeTokenFromFactory(await token.getAddress())
      ).to.be.revertedWithCustomError(dexManager, "ChainCraftDEXManager__InvalidFactoryAddress");
    });
  });

  describe("ETH to Token Swaps", function () {
    beforeEach(async function () {
      // Authorize token for trading
      await dexManager.connect(owner).authorizeToken(await token.getAddress());
    });

    it("Should swap ETH for tokens successfully", async function () {
      const ethAmount = ethers.parseEther("1");
      const expectedTokenOut = ethers.parseUnits("1000", 18);

      // Setup mock router to return expected amount
      await swapRouter.setMockAmountOut(expectedTokenOut);

      const tx = await dexManager.connect(user1).swapETHForTokens(
        await token.getAddress(),
        MOCK_ROUTE,
        { value: ethAmount }
      );

      await expect(tx).to.emit(dexManager, "TokenSwapped")
        .withArgs(
          user1.address,
          await weth.getAddress(),
          await token.getAddress(),
          ethAmount,
          expectedTokenOut,
          MOCK_ROUTE
        );
    });

    it("Should revert swap with unauthorized token", async function () {
      // Deploy unauthorized token
      const Token = await ethers.getContractFactory("ChainCraftToken");
      const unauthorizedToken = await Token.deploy(
        "Unauthorized",
        "UNAUTH",
        1000000,
        user1.address
      );

      await expect(
        dexManager.connect(user1).swapETHForTokens(
          await unauthorizedToken.getAddress(),
          MOCK_ROUTE,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(dexManager, "ChainCraftDEXManager__UnauthorizedToken");
    });

    it("Should revert swap with zero ETH", async function () {
      await expect(
        dexManager.connect(user1).swapETHForTokens(
          await token.getAddress(),
          MOCK_ROUTE,
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(dexManager, "ChainCraftDEXManager__InvalidAmount");
    });
  });

  describe("Token to ETH Swaps", function () {
    beforeEach(async function () {
      // Authorize token and distribute some tokens to user
      await dexManager.connect(owner).authorizeToken(await token.getAddress());
      await token.connect(user1).transfer(user2.address, ethers.parseUnits("10000", 18));
    });

    it("Should swap tokens for ETH successfully", async function () {
      const tokenAmount = ethers.parseUnits("1000", 18);
      const expectedETHOut = ethers.parseEther("0.5");

      // Setup mock router
      await swapRouter.setMockAmountOut(expectedETHOut);

      // Approve tokens for swap
      await token.connect(user2).approve(await dexManager.getAddress(), tokenAmount);

      const tx = await dexManager.connect(user2).swapTokensForETH(
        await token.getAddress(),
        tokenAmount,
        MOCK_ROUTE
      );

      await expect(tx).to.emit(dexManager, "TokenSwapped")
        .withArgs(
          user2.address,
          await token.getAddress(),
          await weth.getAddress(),
          tokenAmount,
          expectedETHOut,
          MOCK_ROUTE
        );
    });

    it("Should revert swap without approval", async function () {
      const tokenAmount = ethers.parseUnits("1000", 18);

      await expect(
        dexManager.connect(user2).swapTokensForETH(
          await token.getAddress(),
          tokenAmount,
          MOCK_ROUTE
        )
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("Should revert swap with zero amount", async function () {
      await expect(
        dexManager.connect(user2).swapTokensForETH(
          await token.getAddress(),
          0,
          MOCK_ROUTE
        )
      ).to.be.revertedWithCustomError(dexManager, "ChainCraftDEXManager__InvalidAmount");
    });
  });

  describe("Generic Swap Function", function () {
    beforeEach(async function () {
      await dexManager.connect(owner).authorizeToken(await token.getAddress());
      await token.connect(user1).transfer(user2.address, ethers.parseUnits("10000", 18));
    });

    it("Should handle ETH to Token swap via generic function", async function () {
      const ethAmount = ethers.parseEther("1");
      const expectedTokenOut = ethers.parseUnits("1000", 18);

      await swapRouter.setMockAmountOut(expectedTokenOut);

      const tx = await dexManager.connect(user1).swap(
        await weth.getAddress(),
        await token.getAddress(),
        ethAmount,
        MOCK_ROUTE,
        { value: ethAmount }
      );

      await expect(tx).to.emit(dexManager, "TokenSwapped");
    });

    it("Should handle Token to ETH swap via generic function", async function () {
      const tokenAmount = ethers.parseUnits("1000", 18);
      const expectedETHOut = ethers.parseEther("0.5");

      await swapRouter.setMockAmountOut(expectedETHOut);
      await token.connect(user2).approve(await dexManager.getAddress(), tokenAmount);

      const tx = await dexManager.connect(user2).swap(
        await token.getAddress(),
        await weth.getAddress(),
        tokenAmount,
        MOCK_ROUTE
      );

      await expect(tx).to.emit(dexManager, "TokenSwapped");
    });

    it("Should handle Token to Token swap", async function () {
      // Deploy second authorized token
      const deployTx = await factory.connect(user1).deployToken(
        "SecondCoin",
        "SECOND",
        1000000,
        { value: ethers.parseEther("0.05") }
      );

      const receipt = await deployTx.wait();
      const tokenDeployedEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TokenDeployed"
      );
      const secondTokenAddress = tokenDeployedEvent.args[2];
      const secondToken = await ethers.getContractAt("ChainCraftToken", secondTokenAddress);

      await dexManager.connect(owner).authorizeToken(secondTokenAddress);

      const tokenAmount = ethers.parseUnits("1000", 18);
      const expectedTokenOut = ethers.parseUnits("500", 18);

      await swapRouter.setMockAmountOut(expectedTokenOut);
      await token.connect(user2).approve(await dexManager.getAddress(), tokenAmount);

      const tx = await dexManager.connect(user2).swap(
        await token.getAddress(),
        secondTokenAddress,
        tokenAmount,
        MOCK_ROUTE
      );

      await expect(tx).to.emit(dexManager, "TokenSwapped");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to withdraw stuck ETH", async function () {
      // Send ETH to contract
      await user1.sendTransaction({
        to: await dexManager.getAddress(),
        value: ethers.parseEther("1")
      });

      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      const tx = await dexManager.connect(owner).withdrawETH();
      const receipt = await tx.wait();
      
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const finalBalance = await ethers.provider.getBalance(owner.address);
      
      expect(finalBalance).to.be.gt(initialBalance.sub(gasUsed));
    });

    it("Should allow owner to withdraw stuck tokens", async function () {
      const tokenAmount = ethers.parseUnits("1000", 18);
      
      // Transfer tokens to DEX manager
      await token.connect(user1).transfer(await dexManager.getAddress(), tokenAmount);
      
      const initialBalance = await token.balanceOf(owner.address);
      
      await dexManager.connect(owner).withdrawToken(await token.getAddress(), tokenAmount);
      
      const finalBalance = await token.balanceOf(owner.address);
      expect(finalBalance).to.equal(initialBalance.add(tokenAmount));
    });

    it("Should revert emergency withdraw when no ETH to withdraw", async function () {
      await expect(
        dexManager.connect(owner).withdrawETH()
      ).to.be.revertedWithCustomError(dexManager, "ChainCraftDEXManager__InvalidAmount");
    });

    it("Should revert emergency functions from non-owner", async function () {
      await expect(
        dexManager.connect(user1).withdrawETH()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        dexManager.connect(user1).withdrawToken(await token.getAddress(), 1000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Integration with Factory", function () {
    it("Should authorize token when deployed through factory", async function () {
      const deployTx = await factory.connect(user1).deployToken(
        "FactoryToken",
        "FACTORY",
        1000000,
        { value: ethers.parseEther("0.05") }
      );

      const receipt = await deployTx.wait();
      const tokenDeployedEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TokenDeployed"
      );
      const newTokenAddress = tokenDeployedEvent.args[2];

      // Token should be able to be authorized by its creator
      await factory.connect(user1).authorizeDEXTrading(newTokenAddress);
      
      expect(await dexManager.authorizedTokens(newTokenAddress)).to.be.true;
    });

    it("Should prevent non-creator from authorizing token for DEX trading", async function () {
      await expect(
        factory.connect(user2).authorizeDEXTrading(await token.getAddress())
      ).to.be.revertedWithCustomError(factory, "ChainCraftFactoryLite__NotTokenCreator");
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle receive function", async function () {
      const tx = await user1.sendTransaction({
        to: await dexManager.getAddress(),
        value: ethers.parseEther("1")
      });
      
      await expect(tx).to.not.be.reverted;
      
      const balance = await ethers.provider.getBalance(await dexManager.getAddress());
      expect(balance).to.equal(ethers.parseEther("1"));
    });

    it("Should handle fallback function", async function () {
      const tx = await user1.sendTransaction({
        to: await dexManager.getAddress(),
        value: ethers.parseEther("1"),
        data: "0x1234"
      });
      
      await expect(tx).to.not.be.reverted;
    });

    it("Should handle large amounts correctly", async function () {
      const largeAmount = ethers.parseEther("1000000");
      
      await dexManager.connect(owner).authorizeToken(await token.getAddress());
      await swapRouter.setMockAmountOut(largeAmount);

      const tx = await dexManager.connect(user1).swapETHForTokens(
        await token.getAddress(),
        MOCK_ROUTE,
        { value: ethers.parseEther("1000") }
      );

      await expect(tx).to.emit(dexManager, "TokenSwapped");
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should use reasonable gas for swaps", async function () {
      await dexManager.connect(owner).authorizeToken(await token.getAddress());
      
      const tx = await dexManager.connect(user1).swapETHForTokens(
        await token.getAddress(),
        MOCK_ROUTE,
        { value: ethers.parseEther("1") }
      );

      const receipt = await tx.wait();
      
      // Gas should be reasonable (less than 200k for simple swap)
      expect(receipt.gasUsed).to.be.lt(200000);
    });
  });
});
