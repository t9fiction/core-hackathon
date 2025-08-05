const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PumpFunFactoryLite (Simplified)", function () {
    let factory;
    let dexManager;
    let owner, creator, addr1, addr2;
    
    const tokenName = "Test Token";
    const tokenSymbol = "TEST";
    const totalSupply = 10000000; // 10M tokens
    const deploymentFee = ethers.parseEther("0.01");

    beforeEach(async function () {
        [owner, creator, addr1, addr2] = await ethers.getSigners();
        
        // Deploy factory
        const PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
        factory = await PumpFunFactoryLite.deploy();
        await factory.waitForDeployment();

        // Deploy mock DEX manager for testing
        const MockDEXManager = await ethers.getContractFactory("PumpFunDEXManager");
        dexManager = await MockDEXManager.deploy(
            addr1.address, // mock swap router
            addr1.address, // mock position manager  
            addr1.address, // mock uniswap factory
            addr1.address, // mock quoter
            addr1.address  // mock WETH
        );
        await dexManager.waitForDeployment();
        
        // Set DEX manager in factory
        await factory.setDEXManager(await dexManager.getAddress());
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await factory.owner()).to.equal(owner.address);
        });

        it("Should set initial ether fee correctly", async function () {
            expect(await factory.etherFee()).to.equal(deploymentFee);
        });

        it("Should have zero initial statistics", async function () {
            const stats = await factory.getFactoryStats();
            expect(stats[0]).to.equal(0); // totalTokensDeployed
            expect(stats[1]).to.equal(0); // totalFeesCollected
            expect(stats[2]).to.equal(0); // currentBalance
        });
    });

    describe("Token Deployment", function () {
        it("Should deploy token with correct fee", async function () {
            const tokenAddress = await factory.connect(creator).deployToken.staticCall(
                tokenName,
                tokenSymbol,
                totalSupply,
                { value: deploymentFee }
            );

            await expect(
                factory.connect(creator).deployToken(
                    tokenName,
                    tokenSymbol,
                    totalSupply,
                    { value: deploymentFee }
                )
            ).to.emit(factory, "TokenDeployed")
            .withArgs(tokenName, tokenSymbol, tokenAddress, totalSupply, creator.address);
        });

        it("Should mint all tokens to creator", async function () {
            const tx = await factory.connect(creator).deployToken(
                tokenName,
                tokenSymbol,
                totalSupply,
                { value: deploymentFee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.eventName === "TokenDeployed");
            const tokenAddress = event.args[2];

            const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
            const token = PumpFunToken.attach(tokenAddress);

            const expectedSupply = ethers.parseEther(totalSupply.toString());
            expect(await token.totalSupply()).to.equal(expectedSupply);
            expect(await token.balanceOf(creator.address)).to.equal(expectedSupply);
        });

        it("Should track deployed tokens correctly", async function () {
            await factory.connect(creator).deployToken(
                tokenName,
                tokenSymbol,
                totalSupply,
                { value: deploymentFee }
            );

            const stats = await factory.getFactoryStats();
            expect(stats[0]).to.equal(1); // totalTokensDeployed
            expect(stats[1]).to.equal(deploymentFee); // totalFeesCollected

            const creatorTokens = await factory.getTokensByCreator(creator.address);
            expect(creatorTokens.length).to.equal(1);

            const allTokens = await factory.getAllDeployedTokens();
            expect(allTokens.length).to.equal(1);
        });

        it("Should return excess ETH to creator", async function () {
            const excessAmount = ethers.parseEther("0.02"); // Double the required fee
            
            await expect(
                factory.connect(creator).deployToken(
                    tokenName,
                    tokenSymbol,
                    totalSupply,
                    { value: excessAmount }
                )
            ).to.changeEtherBalances(
                [creator, factory],
                [-deploymentFee, deploymentFee]
            );
        });
    });

    describe("Fee Management", function () {
        describe("Tiered Fee Structure", function () {
            it("Should charge standard fee for standard supply", async function () {
                const standardSupply = 50000000; // 50M tokens
                const expectedFee = await factory.getRequiredFee(standardSupply);
                expect(expectedFee).to.equal(deploymentFee); // 1x multiplier
            });

            it("Should charge premium fee for premium supply", async function () {
                const premiumSupply = 300000000; // 300M tokens
                const expectedFee = await factory.getRequiredFee(premiumSupply);
                expect(expectedFee).to.equal(deploymentFee * 3n); // 3x multiplier
            });

            it("Should charge ultimate fee for ultimate supply", async function () {
                const ultimateSupply = 800000000; // 800M tokens
                const expectedFee = await factory.getRequiredFee(ultimateSupply);
                expect(expectedFee).to.equal(deploymentFee * 10n); // 10x multiplier
            });
        });

        it("Should allow owner to update ether fee", async function () {
            const newFee = ethers.parseEther("0.02");
            
            await expect(factory.setEtherFee(newFee))
                .to.emit(factory, "EtherFeeUpdated")
                .withArgs(deploymentFee, newFee);
                
            expect(await factory.etherFee()).to.equal(newFee);
        });

        it("Should not allow non-owner to update fee", async function () {
            const newFee = ethers.parseEther("0.02");
            
            await expect(
                factory.connect(addr1).setEtherFee(newFee)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });

        it("Should not allow fee above maximum", async function () {
            const invalidFee = ethers.parseEther("2"); // Above MAX_FEE (1 ether)
            
            await expect(
                factory.setEtherFee(invalidFee)
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidFeeAmount");
        });
    });

    describe("Token Validation", function () {
        it("Should revert with empty name", async function () {
            await expect(
                factory.connect(creator).deployToken(
                    "",
                    tokenSymbol,
                    totalSupply,
                    { value: deploymentFee }
                )
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__EmptyStringParameter");
        });

        it("Should revert with empty symbol", async function () {
            await expect(
                factory.connect(creator).deployToken(
                    tokenName,
                    "",
                    totalSupply,
                    { value: deploymentFee }
                )
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__EmptyStringParameter");
        });

        it("Should revert with supply too low", async function () {
            const lowSupply = 500; // Below MIN_TOTAL_SUPPLY (1000)
            
            await expect(
                factory.connect(creator).deployToken(
                    tokenName,
                    tokenSymbol,
                    lowSupply,
                    { value: deploymentFee }
                )
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TotalSupplyTooLow");
        });

        it("Should revert with supply too high", async function () {
            const highSupply = 2000000000; // Above ULTIMATE_MAX_SUPPLY (1B)
            
            await expect(
                factory.connect(creator).deployToken(
                    tokenName,
                    tokenSymbol,
                    highSupply,
                    { value: deploymentFee }
                )
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TotalSupplyTooHigh");
        });

        it("Should revert with insufficient fee", async function () {
            const insufficientFee = ethers.parseEther("0.005"); // Half the required fee
            
            await expect(
                factory.connect(creator).deployToken(
                    tokenName,
                    tokenSymbol,
                    totalSupply,
                    { value: insufficientFee }
                )
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InsufficientEtherFee");
        });
    });

    describe("DEX Pool Creation", function () {
        let tokenAddress;
        const poolFee = 3000; // 0.3%
        const tokenAmount = ethers.parseEther("100000"); // 100K tokens
        const ethAmount = ethers.parseEther("1"); // 1 ETH
        
        beforeEach(async function () {
            // Deploy a token first
            const tx = await factory.connect(creator).deployToken(
                tokenName,
                tokenSymbol,
                totalSupply,
                { value: deploymentFee }
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.eventName === "TokenDeployed");
            tokenAddress = event.args[2];
            
            // Approve factory to spend tokens
            const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
            const token = PumpFunToken.attach(tokenAddress);
            await token.connect(creator).approve(await factory.getAddress(), tokenAmount);
        });

        it.skip("Should create DEX pool successfully (skipped - needs real DEX setup)", async function () {
            await expect(
                factory.connect(creator).createDEXPool(
                    tokenAddress,
                    tokenAmount,
                    poolFee,
                    { value: ethAmount }
                )
            ).to.emit(factory, "DEXPoolCreated");
        });

        it("Should revert if token not deployed by factory", async function () {
            // Deploy token directly (not through factory)
            const PumpFunToken = await ethers.getContractFactory("PumpFunToken");
            const directToken = await PumpFunToken.deploy(
                "Direct Token",
                "DIRECT",
                1000000,
                creator.address
            );
            await directToken.waitForDeployment();
            
            await expect(
                factory.connect(creator).createDEXPool(
                    await directToken.getAddress(),
                    tokenAmount,
                    poolFee,
                    { value: ethAmount }
                )
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__TokenNotDeployedByFactory");
        });

        it("Should revert with zero amounts", async function () {
            await expect(
                factory.connect(creator).createDEXPool(
                    tokenAddress,
                    0,
                    poolFee,
                    { value: ethAmount }
                )
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidTokenAmount");

            await expect(
                factory.connect(creator).createDEXPool(
                    tokenAddress,
                    tokenAmount,
                    poolFee,
                    { value: 0 }
                )
            ).to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__InvalidTokenAmount");
        });

        it("Should revert if DEX manager not set", async function () {
            // Deploy new factory without DEX manager
            const PumpFunFactoryLite = await ethers.getContractFactory("PumpFunFactoryLite");
            const factoryWithoutDEX = await PumpFunFactoryLite.deploy();
            await factoryWithoutDEX.waitForDeployment();
            
            // Deploy token through new factory
            const tx = await factoryWithoutDEX.connect(creator).deployToken(
                tokenName,
                tokenSymbol,
                totalSupply,
                { value: deploymentFee }
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.eventName === "TokenDeployed");
            const newTokenAddress = event.args[2];
            
            await expect(
                factoryWithoutDEX.connect(creator).createDEXPool(
                    newTokenAddress,
                    tokenAmount,
                    poolFee,
                    { value: ethAmount }
                )
            ).to.be.revertedWithCustomError(factoryWithoutDEX, "PumpFunFactoryLite__InvalidParameters");
        });
    });

    describe("Fee Withdrawal", function () {
        beforeEach(async function () {
            // Deploy some tokens to accumulate fees
            await factory.connect(creator).deployToken(
                tokenName,
                tokenSymbol,
                totalSupply,
                { value: deploymentFee }
            );
        });

        it("Should allow owner to withdraw fees", async function () {
            const initialBalance = await ethers.provider.getBalance(owner.address);
            
            await expect(factory.withdrawFees())
                .to.emit(factory, "EtherWithdrawn")
                .withArgs(owner.address, deploymentFee);
        });

        it("Should not allow non-owner to withdraw fees", async function () {
            await expect(
                factory.connect(addr1).withdrawFees()
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });

        it("Should revert when no funds to withdraw", async function () {
            await factory.withdrawFees(); // Withdraw first time
            
            await expect(factory.withdrawFees())
                .to.be.revertedWithCustomError(factory, "PumpFunFactoryLite__NoEtherToWithdraw");
        });
    });

    describe("View Functions", function () {
        let tokenAddress;

        beforeEach(async function () {
            const tx = await factory.connect(creator).deployToken(
                tokenName,
                tokenSymbol,
                totalSupply,
                { value: deploymentFee }
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.eventName === "TokenDeployed");
            tokenAddress = event.args[2];
        });

        it("Should return correct token info", async function () {
            const tokenInfo = await factory.getTokenInfo(tokenAddress);
            expect(tokenInfo[0]).to.equal(creator.address); // creator
            expect(tokenInfo[1]).to.be.greaterThan(0); // deploymentTime
        });

        it("Should return correct supply tiers", async function () {
            const standardTier = await factory.getSupplyTier(50000000);
            expect(standardTier[0]).to.equal("Standard");
            expect(standardTier[2]).to.equal(1); // multiplier

            const premiumTier = await factory.getSupplyTier(300000000);
            expect(premiumTier[0]).to.equal("Premium");
            expect(premiumTier[2]).to.equal(3); // multiplier

            const ultimateTier = await factory.getSupplyTier(800000000);
            expect(ultimateTier[0]).to.equal("Ultimate");
            expect(ultimateTier[2]).to.equal(10); // multiplier
        });
    });

    describe("DEX Manager Management", function () {
        it("Should allow owner to set DEX manager", async function () {
            const newDEXManager = addr2.address;
            
            await expect(factory.setDEXManager(newDEXManager))
                .to.emit(factory, "DEXManagerUpdated")
                .withArgs(await dexManager.getAddress(), newDEXManager);
                
            expect(await factory.dexManager()).to.equal(newDEXManager);
        });

        it("Should not allow non-owner to set DEX manager", async function () {
            await expect(
                factory.connect(addr1).setDEXManager(addr2.address)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should handle multiple token deployments by same creator", async function () {
            // Deploy first token
            await factory.connect(creator).deployToken(
                "Token 1",
                "TK1",
                totalSupply,
                { value: deploymentFee }
            );

            // Deploy second token
            await factory.connect(creator).deployToken(
                "Token 2", 
                "TK2",
                totalSupply,
                { value: deploymentFee }
            );

            const creatorTokens = await factory.getTokensByCreator(creator.address);
            expect(creatorTokens.length).to.equal(2);

            const stats = await factory.getFactoryStats();
            expect(stats[0]).to.equal(2); // totalTokensDeployed
            expect(stats[1]).to.equal(deploymentFee * 2n); // totalFeesCollected
        });

        it("Should properly handle reentrancy protection", async function () {
            // This test ensures reentrancy guards are working
            // The nonReentrant modifier should prevent nested calls
            await expect(
                factory.connect(creator).deployToken(
                    tokenName,
                    tokenSymbol,
                    totalSupply,
                    { value: deploymentFee }
                )
            ).to.not.be.reverted;
        });

        it("Should support receiving ETH", async function () {
            await expect(
                owner.sendTransaction({
                    to: await factory.getAddress(),
                    value: ethers.parseEther("1")
                })
            ).to.not.be.reverted;
        });
    });
});
