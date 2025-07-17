const { expect } = require("chai");
const { ethers } = require("hardhat");

let PumpFunDEXManager;
let dexManager;
let owner;
let addr1;
let addr2;
let testTokenA;
let testTokenB;

beforeEach(async () => {
  [owner, addr1, addr2, _] = await ethers.getSigners();

  const TestToken = await ethers.getContractFactory("TestToken");
  testTokenA = await TestToken.deploy("Token A", "TKNA", 1000000);
  testTokenB = await TestToken.deploy("Token B", "TKNB", 1000000);

PumpFunDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
  dexManager = await PumpFunDEXManager.deploy(
    ethers.constants.AddressZero, // Mock Swap Router
    ethers.constants.AddressZero, // Mock Position Manager
    ethers.constants.AddressZero, // Mock Uniswap V3 Factory
    ethers.constants.AddressZero  // Mock WETH
  );
});

describe("PumpFunDEXManager", function () {
  describe("createLiquidityPool", function () {
    it("should create a liquidity pool for two tokens", async function () {
      const fee = 3000;
      await dexManager.authorizeToken(testTokenA.address);
      await dexManager.authorizeToken(testTokenB.address);

      await testTokenA.approve(dexManager.address, 500);
      await testTokenB.approve(dexManager.address, 500);

      await dexManager.createLiquidityPool(testTokenA.address, testTokenB.address, fee, 500, 500);

      const poolInfo = await dexManager.getPoolInfo(testTokenA.address, testTokenB.address, fee);

      expect(poolInfo.isActive).to.be.true;
      expect(poolInfo.liquidity).to.equal(500);
    });
  });
});

