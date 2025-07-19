import { expect } from "chai";
import { ethers } from "hardhat";
import { PumpFunFactoryLite, PumpFunToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PumpFunFactoryLite", function () {
    let factory: PumpFunFactoryLite;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let governance: SignerWithAddress;
    let airdropContract: SignerWithAddress;

    beforeEach(async function () {
        [owner, user1, user2, governance, airdropContract] = await ethers.getSigners();

        const FactoryContract = await ethers.getContractFactory("PumpFunFactoryLite");
        factory = await FactoryContract.deploy();
        await factory.waitForDeployment();

        // Set airdrop contract
        await factory.setAirdropManager(airdropContract.address);
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await factory.owner()).to.equal(owner.address);
        });

        it("Should set default ether fee", async function () {
            expect(await factory.etherFee()).to.equal(ethers.parseEther("0.05"));
        });

        it("Should initialize with default settings", async function () {
            expect(await factory.autoCreatePools()).to.be.true;
            expect(await factory.defaultLiquidityPercentage()).to.equal(80);
            expect(await factory.totalTokensDeployed()).to.equal(0);
        });
    });

    describe("Token Deployment", function () {
        const TOKEN_NAME = "TestToken";
        const TOKEN_SYMBOL = "TEST";
        const INITIAL_SUPPLY = 1000000;
        const LOCK_PERIOD = 30;

        it("Should deploy token successfully with correct parameters", async function () {
            const deploymentFee = await factory.etherFee();
            
            await expect(
                factory.connect(user1).deployToken(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY, LOCK_PERIOD, {
                    value: deploymentFee
                })
            ).to.emit(factory, "TokenDeployed");

            expect(await factory.totalTokensDeployed()).to.equal(1);
            
            const creatorTokens = await factory.creatorTokens(user1.address, 0);
            expect(creatorTokens).to.not.equal(ethers.ZeroAddress);
            
            const tokenInfo = await factory.tokenInfo(creatorTokens);
            expect(tokenInfo.creator).to.equal(user1.address);
            expect(tokenInfo.liquidityLockPeriodDays).to.equal(LOCK_PERIOD);
        });

        it("Should revert with insufficient deployment fee", async function () {
            const deploymentFee = await factory.etherFee();
            const insufficientFee = deploymentFee - 1n;

            await expect(
                factory.connect(user1).deployToken(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY, LOCK_PERIOD, {
                    value: insufficientFee
                })
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InsufficientEtherFee");
        });

        it("Should refund excess ETH", async function () {
            const deploymentFee = await factory.etherFee();
            const excessFee = deploymentFee + ethers.parseEther("0.1");
            
            const balanceBefore = await ethers.provider.getBalance(user1.address);
            
            const tx = await factory.connect(user1).deployToken(
                TOKEN_NAME, 
                TOKEN_SYMBOL, 
                INITIAL_SUPPLY, 
                LOCK_PERIOD, 
                { value: excessFee }
            );
            
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
            const balanceAfter = await ethers.provider.getBalance(user1.address);
            
            // User should have paid only the deployment fee plus gas
            expect(balanceBefore - balanceAfter).to.be.closeTo(deploymentFee + gasUsed, ethers.parseEther("0.001"));
        });

        it("Should revert with invalid parameters", async function () {
            const deploymentFee = await factory.etherFee();

            // Empty name
            await expect(
                factory.connect(user1).deployToken("", TOKEN_SYMBOL, INITIAL_SUPPLY, LOCK_PERIOD, {
                    value: deploymentFee
                })
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__EmptyStringParameter");

            // Empty symbol
            await expect(
                factory.connect(user1).deployToken(TOKEN_NAME, "", INITIAL_SUPPLY, LOCK_PERIOD, {
                    value: deploymentFee
                })
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__EmptyStringParameter");

            // Too low supply
            await expect(
                factory.connect(user1).deployToken(TOKEN_NAME, TOKEN_SYMBOL, 500, LOCK_PERIOD, {
                    value: deploymentFee
                })
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TotalSupplyTooLow");

            // Too short lock period
            await expect(
                factory.connect(user1).deployToken(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY, 15, {
                    value: deploymentFee
                })
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InsufficientLiquidityLockPeriod");
        });

        it("Should calculate fees correctly for different supply tiers", async function () {
            const baseFee = await factory.etherFee();

            // Standard tier (100M tokens)
            const standardSupply = 100000000;
            const standardFee = await factory.getRequiredFee(standardSupply);
            expect(standardFee).to.equal(baseFee);

            // Premium tier (500M tokens)  
            const premiumSupply = 500000000;
            const premiumFee = await factory.getRequiredFee(premiumSupply);
            expect(premiumFee).to.equal(baseFee * 3n);

            // Ultimate tier (1B tokens)
            const ultimateSupply = 1000000000;
            const ultimateFee = await factory.getRequiredFee(ultimateSupply);
            expect(ultimateFee).to.equal(baseFee * 10n);
        });

        it("Should track tokens properly", async function () {
            const deploymentFee = await factory.etherFee();
            
            // Deploy first token
            await factory.connect(user1).deployToken(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY, LOCK_PERIOD, {
                value: deploymentFee
            });

            // Deploy second token
            await factory.connect(user1).deployToken("Token2", "TK2", INITIAL_SUPPLY, LOCK_PERIOD, {
                value: deploymentFee
            });

            expect(await factory.totalTokensDeployed()).to.equal(2);
            
            const token1Address = await factory.creatorTokens(user1.address, 0);
            const token2Address = await factory.creatorTokens(user1.address, 1);
            
            expect(await factory.isDeployedToken(token1Address)).to.be.true;
            expect(await factory.isDeployedToken(token2Address)).to.be.true;
            expect(await factory.allDeployedTokens(0)).to.equal(token1Address);
            expect(await factory.allDeployedTokens(1)).to.equal(token2Address);
        });
    });

    describe("Fee Management", function () {
        it("Should allow owner to update ether fee", async function () {
            const newFee = ethers.parseEther("0.1");
            const oldFee = await factory.etherFee();

            await expect(factory.connect(owner).setEtherFee(newFee))
                .to.emit(factory, "EtherFeeUpdated")
                .withArgs(oldFee, newFee);

            expect(await factory.etherFee()).to.equal(newFee);
        });

        it("Should not allow fee above maximum", async function () {
            const maxFee = await factory.MAX_FEE();
            const excessiveFee = maxFee + 1n;

            await expect(
                factory.connect(owner).setEtherFee(excessiveFee)
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidFeeAmount");
        });

        it("Should not allow non-owner to update fee", async function () {
            const newFee = ethers.parseEther("0.1");

            await expect(
                factory.connect(user1).setEtherFee(newFee)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });

        it("Should allow owner to withdraw fees", async function () {
            const deploymentFee = await factory.etherFee();
            
            // Deploy a token to generate fees
            await factory.connect(user1).deployToken("Test", "TST", 1000000, 30, {
                value: deploymentFee
            });

            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

            await expect(factory.connect(owner).withdrawFees())
                .to.emit(factory, "EtherWithdrawn")
                .withArgs(owner.address, deploymentFee);

            const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
            expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
        });

        it("Should revert withdraw when no ether to withdraw", async function () {
            await expect(
                factory.connect(owner).withdrawFees()
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__NoEtherToWithdraw");
        });
    });

    describe("Governance Management", function () {
        it("Should allow owner to set governance manager", async function () {
            await expect(factory.connect(owner).setGovernanceManager(governance.address))
                .to.emit(factory, "GovernanceManagerUpdated")
                .withArgs(ethers.ZeroAddress, governance.address);

            expect(await factory.governanceManager()).to.equal(governance.address);
        });

        it("Should not allow zero address as governance manager", async function () {
            await expect(
                factory.connect(owner).setGovernanceManager(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidGovernanceAddress");
        });

        it("Should update governance for existing tokens", async function () {
            // First deploy a token
            const deploymentFee = await factory.etherFee();
            const tx = await factory.connect(user1).deployToken("Test", "TST", 1000000, 30, {
                value: deploymentFee
            });
            const receipt = await tx.wait();
            
            // Extract token address from event
            const event = receipt?.logs.find(log => {
                try {
                    const parsed = factory.interface.parseLog(log);
                    return parsed?.name === "TokenDeployed";
                } catch {
                    return false;
                }
            });
            const parsedEvent = factory.interface.parseLog(event!);
            const tokenAddress = parsedEvent?.args[2];

            // Set governance manager
            await factory.connect(owner).setGovernanceManager(governance.address);

            // Update governance for the token
            await expect(
                factory.connect(owner).updateGovernanceForTokens([tokenAddress])
            ).to.emit(factory, "TokensGovernanceUpdated")
            .withArgs([tokenAddress], governance.address);

            // Verify governance is set in the token
            const token = await ethers.getContractAt("PumpFunToken", tokenAddress);
            expect(await token.governanceContract()).to.equal(governance.address);
        });

        it("Should revert updating governance for non-deployed tokens", async function () {
            const fakeTokenAddress = user1.address; // Use a random address

            await factory.connect(owner).setGovernanceManager(governance.address);

            await expect(
                factory.connect(owner).updateGovernanceForTokens([fakeTokenAddress])
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TokenNotDeployedByFactory");
        });
    });

    describe("Airdrop Management", function () {
        it("Should allow owner to set airdrop manager", async function () {
            const newAirdropContract = user2.address;

            await expect(factory.connect(owner).setAirdropManager(newAirdropContract))
                .to.emit(factory, "AirdropManagerUpdated")
                .withArgs(airdropContract.address, newAirdropContract);

            expect(await factory.airdropContract()).to.equal(newAirdropContract);
        });

        it("Should not allow zero address as airdrop manager", async function () {
            await expect(
                factory.connect(owner).setAirdropManager(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidAirdropAddress");
        });

        it("Should return correct airdrop contract", async function () {
            expect(await factory.getAirdropContract()).to.equal(airdropContract.address);
        });
    });

    describe("Pool Management", function () {
        it("Should allow owner to toggle auto pool creation", async function () {
            expect(await factory.autoCreatePools()).to.be.true;

            await factory.connect(owner).setAutoCreatePools(false);
            expect(await factory.autoCreatePools()).to.be.false;

            await factory.connect(owner).setAutoCreatePools(true);
            expect(await factory.autoCreatePools()).to.be.true;
        });

        it("Should allow owner to set default liquidity percentage", async function () {
            const newPercentage = 60;

            await factory.connect(owner).setDefaultLiquidityPercentage(newPercentage);
            expect(await factory.defaultLiquidityPercentage()).to.equal(newPercentage);
        });

        it("Should not allow liquidity percentage above 100", async function () {
            await expect(
                factory.connect(owner).setDefaultLiquidityPercentage(101)
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidParameters");
        });
    });

    describe("View Functions", function () {
        it("Should return correct creator tokens", async function () {
            const deploymentFee = await factory.etherFee();
            
            // Deploy multiple tokens
            await factory.connect(user1).deployToken("Token1", "TK1", 1000000, 30, {
                value: deploymentFee
            });
            await factory.connect(user1).deployToken("Token2", "TK2", 1000000, 30, {
                value: deploymentFee
            });

            const token1 = await factory.creatorTokens(user1.address, 0);
            const token2 = await factory.creatorTokens(user1.address, 1);

            expect(token1).to.not.equal(ethers.ZeroAddress);
            expect(token2).to.not.equal(ethers.ZeroAddress);
            expect(token1).to.not.equal(token2);
        });

        it("Should return correct token info", async function () {
            const deploymentFee = await factory.etherFee();
            const lockPeriod = 45;
            
            const tx = await factory.connect(user1).deployToken("TestToken", "TST", 1000000, lockPeriod, {
                value: deploymentFee
            });
            
            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
                try {
                    const parsed = factory.interface.parseLog(log);
                    return parsed?.name === "TokenDeployed";
                } catch {
                    return false;
                }
            });
            const parsedEvent = factory.interface.parseLog(event!);
            const tokenAddress = parsedEvent?.args[2];

            const tokenInfo = await factory.tokenInfo(tokenAddress);
            expect(tokenInfo.tokenAddress).to.equal(tokenAddress);
            expect(tokenInfo.creator).to.equal(user1.address);
            expect(tokenInfo.liquidityLockPeriodDays).to.equal(lockPeriod);
            expect(tokenInfo.deploymentTime).to.be.gt(0);
        });

        it("Should return correct constants", async function () {
            expect(await factory.MAX_FEE()).to.equal(ethers.parseEther("1"));
            expect(await factory.MIN_TOTAL_SUPPLY()).to.equal(1000);
            expect(await factory.STANDARD_MAX_SUPPLY()).to.equal(100000000);
            expect(await factory.PREMIUM_MAX_SUPPLY()).to.equal(500000000);
            expect(await factory.ULTIMATE_MAX_SUPPLY()).to.equal(1000000000);
            expect(await factory.MIN_LIQUIDITY_LOCK_PERIOD_DAYS()).to.equal(30);
        });
    });

    describe("Access Control", function () {
        it("Should only allow owner to call owner functions", async function () {
            const newFee = ethers.parseEther("0.1");

            await expect(
                factory.connect(user1).setEtherFee(newFee)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

            await expect(
                factory.connect(user1).setGovernanceManager(governance.address)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

            await expect(
                factory.connect(user1).setAirdropManager(airdropContract.address)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

            await expect(
                factory.connect(user1).withdrawFees()
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
    });

    describe("Integration", function () {
        it("Should deploy token with governance set automatically", async function () {
            // Set governance manager first
            await factory.connect(owner).setGovernanceManager(governance.address);

            // Deploy token
            const deploymentFee = await factory.etherFee();
            const tx = await factory.connect(user1).deployToken("Test", "TST", 1000000, 30, {
                value: deploymentFee
            });
            
            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
                try {
                    const parsed = factory.interface.parseLog(log);
                    return parsed?.name === "TokenDeployed";
                } catch {
                    return false;
                }
            });
            const parsedEvent = factory.interface.parseLog(event!);
            const tokenAddress = parsedEvent?.args[2];

            // Check that governance is already set
            const token = await ethers.getContractAt("PumpFunToken", tokenAddress);
            expect(await token.governanceContract()).to.equal(governance.address);
        });
    });
});
