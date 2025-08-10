const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainCraft Integration (Simplified)", function () {
    let factory;
    let owner, creator, trader1, trader2;
    
    const tokenName = "PumpCoin";
    const tokenSymbol = "PUMP";
    const totalSupply = 1000000; // 1M tokens
    const deploymentFee = ethers.parseEther("0.05");

    beforeEach(async function () {
        [owner, creator, trader1, trader2] = await ethers.getSigners();
        
        // Deploy factory
        const ChainCraftFactoryLite = await ethers.getContractFactory("ChainCraftFactoryLite");
        factory = await ChainCraftFactoryLite.deploy();
        await factory.waitForDeployment();
    });

    describe("Complete Token Lifecycle", function () {
        let tokenAddress;
        let token;

        it("Should deploy token and demonstrate complete flow", async function () {
            // Step 1: Deploy token through factory
            console.log("📝 Step 1: Deploying token through factory...");
            
            const deployTx = await factory.connect(creator).deployToken(
                tokenName,
                tokenSymbol,
                totalSupply,
                { value: deploymentFee }
            );
            const receipt = await deployTx.wait();
            const event = receipt.logs.find(log => log.eventName === "TokenDeployed");
            tokenAddress = event.args[2];

            console.log(`✅ Token deployed at: ${tokenAddress}`);
            console.log(`   Name: ${tokenName}, Symbol: ${tokenSymbol}`);
            console.log(`   Total Supply: ${totalSupply.toLocaleString()} tokens`);

            // Get token contract instance
            const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
            token = ChainCraftToken.attach(tokenAddress);

            // Verify token properties
            expect(await token.name()).to.equal(tokenName);
            expect(await token.symbol()).to.equal(tokenSymbol);
            expect(await token.owner()).to.equal(creator.address);
            
            const expectedSupply = ethers.parseEther(totalSupply.toString());
            expect(await token.totalSupply()).to.equal(expectedSupply);
            expect(await token.balanceOf(creator.address)).to.equal(expectedSupply);

            console.log(`✅ All tokens (${ethers.formatEther(expectedSupply)}) minted to creator`);
        });

        it("Should handle token distribution and trading", async function () {
            // Deploy token first
            const deployTx = await factory.connect(creator).deployToken(
                tokenName,
                tokenSymbol,
                totalSupply,
                { value: deploymentFee }
            );
            const receipt = await deployTx.wait();
            const event = receipt.logs.find(log => log.eventName === "TokenDeployed");
            tokenAddress = event.args[2];

            const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
            token = ChainCraftToken.attach(tokenAddress);

            console.log("📝 Step 2: Creator distributing tokens...");

            // Step 2: Creator distributes tokens to traders
            const distributionAmount = ethers.parseEther("10000"); // 10K tokens each
            
            await token.connect(creator).transfer(trader1.address, distributionAmount);
            await token.connect(creator).transfer(trader2.address, distributionAmount);

            console.log(`✅ Distributed ${ethers.formatEther(distributionAmount)} tokens to each trader`);

            // Verify balances
            expect(await token.balanceOf(trader1.address)).to.equal(distributionAmount);
            expect(await token.balanceOf(trader2.address)).to.equal(distributionAmount);

            const creatorBalance = await token.balanceOf(creator.address);
            const expectedCreatorBalance = ethers.parseEther(totalSupply.toString()) - (distributionAmount * 2n);
            expect(creatorBalance).to.equal(expectedCreatorBalance);

            console.log("📝 Step 3: Peer-to-peer trading...");

            // Step 3: P2P trading between users
            const tradeAmount = ethers.parseEther("1000"); // 1K tokens
            
            await token.connect(trader1).transfer(trader2.address, tradeAmount);

            console.log(`✅ Trader1 sent ${ethers.formatEther(tradeAmount)} tokens to Trader2`);

            // Verify final balances
            expect(await token.balanceOf(trader1.address)).to.equal(distributionAmount - tradeAmount);
            expect(await token.balanceOf(trader2.address)).to.equal(distributionAmount + tradeAmount);

            console.log("📝 Step 4: Token burning...");

            // Step 4: Demonstrate token burning
            const burnAmount = ethers.parseEther("500");
            const initialSupply = await token.totalSupply();
            
            await token.connect(trader2).burn(burnAmount);

            console.log(`✅ Burned ${ethers.formatEther(burnAmount)} tokens`);

            // Verify supply reduction
            const newSupply = await token.totalSupply();
            expect(newSupply).to.equal(initialSupply - burnAmount);
            expect(await token.balanceOf(trader2.address)).to.equal(distributionAmount + tradeAmount - burnAmount);

            console.log(`✅ Total supply reduced to ${ethers.formatEther(newSupply)}`);
        });

        it("Should demonstrate factory statistics and management", async function () {
            console.log("📝 Step 5: Testing factory statistics...");

            // Deploy multiple tokens
            await factory.connect(creator).deployToken("Token1", "TK1", 100000, { value: deploymentFee });
            await factory.connect(trader1).deployToken("Token2", "TK2", 200000, { value: deploymentFee });
            await factory.connect(trader2).deployToken("Token3", "TK3", 300000, { value: deploymentFee });

            // Check factory stats
            const stats = await factory.getFactoryStats();
            expect(stats[0]).to.equal(3); // totalTokensDeployed
            expect(stats[1]).to.equal(deploymentFee * 3n); // totalFeesCollected

            console.log(`✅ Factory deployed ${stats[0]} tokens`);
            console.log(`✅ Factory collected ${ethers.formatEther(stats[1])} ETH in fees`);

            // Check token lists
            const creatorTokens = await factory.getTokensByCreator(creator.address);
            expect(creatorTokens.length).to.equal(1);

            const trader1Tokens = await factory.getTokensByCreator(trader1.address);
            expect(trader1Tokens.length).to.equal(1);

            const allTokens = await factory.getAllDeployedTokens();
            expect(allTokens.length).to.equal(3);

            console.log(`✅ Total tokens in ecosystem: ${allTokens.length}`);

            // Test fee withdrawal
            const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
            const withdrawTx = await factory.withdrawFees();
            const withdrawReceipt = await withdrawTx.wait();
            const gasUsed = withdrawReceipt.gasUsed * withdrawReceipt.gasPrice;

            const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
            const expectedBalance = initialOwnerBalance + stats[1] - gasUsed;
            
            // Allow for small gas estimation differences
            expect(finalOwnerBalance).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));

            console.log(`✅ Factory owner withdrew ${ethers.formatEther(stats[1])} ETH`);
        });

        it("Should demonstrate different fee tiers", async function () {
            console.log("📝 Step 6: Testing fee tiers...");

            // Standard tier (50M tokens)
            const standardSupply = 50000000;
            const standardFee = await factory.getRequiredFee(standardSupply);
            expect(standardFee).to.equal(deploymentFee);

            // Premium tier (300M tokens) 
            const premiumSupply = 300000000;
            const premiumFee = await factory.getRequiredFee(premiumSupply);
            expect(premiumFee).to.equal(deploymentFee * 5n);

            // Ultimate tier (800M tokens)
            const ultimateSupply = 800000000;
            const ultimateFee = await factory.getRequiredFee(ultimateSupply);
            expect(ultimateFee).to.equal(deploymentFee * 10n);

            console.log(`✅ Standard fee (${standardSupply.toLocaleString()} tokens): ${ethers.formatEther(standardFee)} ETH`);
            console.log(`✅ Premium fee (${premiumSupply.toLocaleString()} tokens): ${ethers.formatEther(premiumFee)} ETH`);
            console.log(`✅ Ultimate fee (${ultimateSupply.toLocaleString()} tokens): ${ethers.formatEther(ultimateFee)} ETH`);

            // Test deploying with different tiers
            await factory.connect(creator).deployToken("Premium", "PREM", premiumSupply, { value: premiumFee });
            console.log(`✅ Successfully deployed premium token with ${ethers.formatEther(premiumFee)} ETH fee`);
        });
    });

    describe("Error Handling and Edge Cases", function () {
        it("Should handle all validation errors gracefully", async function () {
            console.log("📝 Step 7: Testing error handling...");

            // Test insufficient fee
            await expect(
                factory.connect(creator).deployToken(tokenName, tokenSymbol, totalSupply, { value: ethers.parseEther("0.005") })
            ).to.be.revertedWithCustomError(factory, "ChainCraftFactoryLite__InsufficientEtherFee");

            // Test empty name
            await expect(
                factory.connect(creator).deployToken("", tokenSymbol, totalSupply, { value: deploymentFee })
            ).to.be.revertedWithCustomError(factory, "ChainCraftFactoryLite__EmptyStringParameter");

            // Test supply too high
            await expect(
                factory.connect(creator).deployToken(tokenName, tokenSymbol, 2000000000, { value: deploymentFee })
            ).to.be.revertedWithCustomError(factory, "ChainCraftFactoryLite__TotalSupplyTooHigh");

            console.log("✅ All validation errors handled correctly");
        });

        it("Should handle token operations correctly", async function () {
            // Deploy token
            const deployTx = await factory.connect(creator).deployToken(tokenName, tokenSymbol, totalSupply, { value: deploymentFee });
            const receipt = await deployTx.wait();
            const event = receipt.logs.find(log => log.eventName === "TokenDeployed");
            const tokenAddress = event.args[2];

            const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
            const token = ChainCraftToken.attach(tokenAddress);

            // Test transfer to zero address should fail
            await expect(
                token.connect(creator).transfer(ethers.ZeroAddress, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");

            // Test insufficient balance transfer should fail
            await expect(
                token.connect(trader1).transfer(trader2.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");

            console.log("✅ All token operation errors handled correctly");
        });
    });
});
