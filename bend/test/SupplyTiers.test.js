const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Supply Tiers Test", function () {
    let factory;
    let owner;
    
    beforeEach(async function () {
        [owner] = await ethers.getSigners();
        
        const PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
        factory = await PumpFunFactoryLite.deploy();
        await factory.waitForDeployment();
    });

    describe("Supply Tier Constants", function () {
        it("Should have correct supply tier constants", async function () {
            expect(await factory.STANDARD_MAX_SUPPLY()).to.equal(100000000); // 100M
            expect(await factory.PREMIUM_MAX_SUPPLY()).to.equal(500000000);  // 500M
            expect(await factory.ULTIMATE_MAX_SUPPLY()).to.equal(1000000000); // 1B
        });

        it("Should have correct fee multipliers", async function () {
            expect(await factory.STANDARD_FEE_MULTIPLIER()).to.equal(1);
            expect(await factory.PREMIUM_FEE_MULTIPLIER()).to.equal(3);
            expect(await factory.ULTIMATE_FEE_MULTIPLIER()).to.equal(10);
        });
    });

    describe("Supply Tier Functions", function () {
        it("Should return correct tier for Standard supply", async function () {
            const supply = 50000000; // 50M tokens
            const [tier, maxSupply, feeMultiplier] = await factory.getSupplyTier(supply);
            
            expect(tier).to.equal("Standard");
            expect(maxSupply).to.equal(100000000);
            expect(feeMultiplier).to.equal(1);
        });

        it("Should return correct tier for Premium supply", async function () {
            const supply = 300000000; // 300M tokens
            const [tier, maxSupply, feeMultiplier] = await factory.getSupplyTier(supply);
            
            expect(tier).to.equal("Premium");
            expect(maxSupply).to.equal(500000000);
            expect(feeMultiplier).to.equal(3);
        });

        it("Should return correct tier for Ultimate supply", async function () {
            const supply = 800000000; // 800M tokens
            const [tier, maxSupply, feeMultiplier] = await factory.getSupplyTier(supply);
            
            expect(tier).to.equal("Ultimate");
            expect(maxSupply).to.equal(1000000000);
            expect(feeMultiplier).to.equal(10);
        });

        it("Should calculate correct fees for each tier", async function () {
            const baseFee = await factory.etherFee();
            
            // Standard tier
            const standardSupply = 50000000;
            const standardFee = await factory.getRequiredFee(standardSupply);
            expect(standardFee).to.equal(baseFee * 1n);
            
            // Premium tier
            const premiumSupply = 300000000;
            const premiumFee = await factory.getRequiredFee(premiumSupply);
            expect(premiumFee).to.equal(baseFee * 3n);
            
            // Ultimate tier
            const ultimateSupply = 800000000;
            const ultimateFee = await factory.getRequiredFee(ultimateSupply);
            expect(ultimateFee).to.equal(baseFee * 10n);
        });
    });

    describe("Token Deployment with Tiers", function () {
        it("Should deploy Standard tier token with correct fee", async function () {
            const supply = 50000000; // 50M tokens
            const requiredFee = await factory.getRequiredFee(supply);
            
            await expect(
                factory.deployToken("TestToken", "TEST", supply, 30, { value: requiredFee })
            ).to.not.be.reverted;
        });

        it("Should fail to deploy Standard tier token with insufficient fee", async function () {
            const supply = 50000000; // 50M tokens
            const requiredFee = await factory.getRequiredFee(supply);
            const insufficientFee = requiredFee - 1n;
            
            await expect(
                factory.deployToken("TestToken", "TEST", supply, 30, { value: insufficientFee })
            ).to.be.revertedWithCustomError(factory, "InsufficientEtherFee");
        });

        it("Should deploy Premium tier token with correct fee", async function () {
            const supply = 300000000; // 300M tokens
            const requiredFee = await factory.getRequiredFee(supply);
            
            await expect(
                factory.deployToken("PremiumToken", "PREM", supply, 30, { value: requiredFee })
            ).to.not.be.reverted;
        });

        it("Should fail to deploy token with supply exceeding ultimate limit", async function () {
            const supply = 1000000001; // 1B + 1 token
            
            await expect(
                factory.deployToken("TooBig", "BIG", supply, 30, { value: ethers.parseEther("1") })
            ).to.be.revertedWithCustomError(factory, "TotalSupplyTooHigh");
        });
    });
});
