const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Anti-Rug Protection Tests", function () {
    let factory;
    let token;
    let owner, creator, user1, user2, user3;
    
    const tokenName = "ProtectedToken";
    const tokenSymbol = "PROT";
    const totalSupply = 1000000; // 1M tokens = 1M * 10^18 actual tokens
    const deploymentFee = ethers.parseEther("0.05");

    beforeEach(async function () {
        [owner, creator, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy factory
        const ChainCraftFactoryLite = await ethers.getContractFactory("ChainCraftFactoryLite");
        factory = await ChainCraftFactoryLite.deploy();
        await factory.waitForDeployment();
        
        // Deploy token through factory
        const deployTx = await factory.connect(creator).deployToken(
            tokenName,
            tokenSymbol,
            totalSupply,
            { value: deploymentFee }
        );
        const receipt = await deployTx.wait();
        const event = receipt.logs.find(log => log.eventName === "TokenDeployed");
        const tokenAddress = event.args[2];

        // Get token contract instance
        const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
        token = ChainCraftToken.attach(tokenAddress);
    });

    describe("Transfer Limits", function () {
        it("Should allow transfers up to 5% of total supply", async function () {
            const totalTokens = await token.totalSupply();
            const maxTransfer = totalTokens * 5n / 100n; // 5% of total supply
            
            // Creator should be able to transfer exactly 5% to user1
            await expect(
                token.connect(creator).transfer(user1.address, maxTransfer)
            ).to.not.be.reverted;
            
            expect(await token.balanceOf(user1.address)).to.equal(maxTransfer);
        });

        it("Should reject transfers exceeding 5% of total supply from non-exempt users", async function () {
            const totalTokens = await token.totalSupply();
            const transferAmount = totalTokens * 10n / 100n; // 10% of total supply
            const exceededAmount = totalTokens * 5n / 100n + 1n; // 5% + 1 wei
            
            // First give user1 some tokens (10%)
            await token.connect(creator).transfer(user1.address, transferAmount);
            
            // Now user1 tries to transfer more than 5% - should fail
            await expect(
                token.connect(user1).transfer(user2.address, exceededAmount)
            ).to.be.revertedWithCustomError(token, "ChainCraftToken__TransferLimitExceeded");
        });

        it("Should allow factory and owner to bypass transfer limits", async function () {
            const totalTokens = await token.totalSupply();
            const largeAmount = totalTokens * 50n / 100n; // 50% of total supply
            
            // Creator (owner) should be able to transfer large amounts
            await expect(
                token.connect(creator).transfer(user1.address, largeAmount)
            ).to.not.be.reverted;
            
            expect(await token.balanceOf(user1.address)).to.equal(largeAmount);
        });
    });

    describe("Holding Limits", function () {
        it("Should allow holdings up to 5% of total supply", async function () {
            const totalTokens = await token.totalSupply();
            const maxHolding = totalTokens * 5n / 100n; // 5% of total supply
            
            // Transfer exactly 5% to user1
            await token.connect(creator).transfer(user1.address, maxHolding);
            expect(await token.balanceOf(user1.address)).to.equal(maxHolding);
        });

        it("Should reject transfers that would cause holding to exceed 5%", async function () {
            const totalTokens = await token.totalSupply();
            const maxHolding = totalTokens * 5n / 100n; // 5% of total supply
            const largeAmount = totalTokens * 10n / 100n; // 10% of total supply
            
            // Give user2 some tokens (10%) so they can send to user1
            await token.connect(creator).transfer(user2.address, largeAmount);
            
            // First transfer 5% to user1
            await token.connect(user2).transfer(user1.address, maxHolding);
            
            // Try to transfer even 1 more token from user2 to user1 - should fail
            await expect(
                token.connect(user2).transfer(user1.address, 1n)
            ).to.be.revertedWithCustomError(token, "ChainCraftToken__HoldingLimitExceeded");
        });

        it("Should allow multiple small transfers within the 5% limit", async function () {
            const totalTokens = await token.totalSupply();
            const smallTransfer = totalTokens * 1n / 100n; // 1% of total supply
            const largeAmount = totalTokens * 20n / 100n; // 20% to user2 for redistribution
            
            // Give user2 some tokens for redistribution
            await token.connect(creator).transfer(user2.address, largeAmount);
            
            // Transfer 1% five times from user2 to user1
            await token.connect(user2).transfer(user1.address, smallTransfer);
            await token.connect(user2).transfer(user1.address, smallTransfer);
            await token.connect(user2).transfer(user1.address, smallTransfer);
            await token.connect(user2).transfer(user1.address, smallTransfer);
            
            // 5th transfer (total would be 5%) should still work
            await token.connect(user2).transfer(user1.address, smallTransfer);
            expect(await token.balanceOf(user1.address)).to.equal(smallTransfer * 5n);
            
            // 6th transfer should fail
            await expect(
                token.connect(user2).transfer(user1.address, 1n)
            ).to.be.revertedWithCustomError(token, "ChainCraftToken__HoldingLimitExceeded");
        });
    });

    describe("Exemptions", function () {
        it("Should exempt factory address from limits", async function () {
            const factoryAddress = await factory.getAddress();
            const totalTokens = await token.totalSupply();
            const largeAmount = totalTokens * 50n / 100n; // 50% of total supply
            
            // Creator transfers to factory should not be limited
            await expect(
                token.connect(creator).transfer(factoryAddress, largeAmount)
            ).to.not.be.reverted;
            
            expect(await token.balanceOf(factoryAddress)).to.equal(largeAmount);
        });

        it("Should exempt token owner from limits", async function () {
            const totalTokens = await token.totalSupply();
            const largeAmount = totalTokens * 90n / 100n; // 90% of total supply
            
            // Creator (owner) should be able to transfer large amounts
            await expect(
                token.connect(creator).transfer(user1.address, largeAmount)
            ).to.not.be.reverted;
        });

        it("Should allow transfers between exempted addresses", async function () {
            const factoryAddress = await factory.getAddress();
            const totalTokens = await token.totalSupply();
            const largeAmount = totalTokens * 30n / 100n; // 30% of total supply
            
            // Transfer from creator to factory
            await token.connect(creator).transfer(factoryAddress, largeAmount);
            
            // We can't directly test factory transferring back since we don't control factory's private key
            // But we can verify the factory received the tokens without limits
            expect(await token.balanceOf(factoryAddress)).to.equal(largeAmount);
        });
    });

    describe("Burning", function () {
        it("Should not be limited by transfer limits when burning", async function () {
            const totalTokens = await token.totalSupply();
            const largeAmount = totalTokens * 10n / 100n; // 10% of total supply
            
            // Transfer to user1
            await token.connect(creator).transfer(user1.address, largeAmount);
            
            // User should be able to burn any amount they own
            await expect(
                token.connect(user1).burn(largeAmount)
            ).to.not.be.reverted;
            
            expect(await token.balanceOf(user1.address)).to.equal(0);
        });
    });

    describe("Helper Functions", function () {
        it("Should return correct transfer limit", async function () {
            const totalTokens = await token.totalSupply();
            const expectedLimit = totalTokens * 5n / 100n;
            
            expect(await token.getTransferLimit()).to.equal(expectedLimit);
        });

        it("Should return correct holding limit", async function () {
            const totalTokens = await token.totalSupply();
            const expectedLimit = totalTokens * 5n / 100n;
            
            expect(await token.getHoldingLimit()).to.equal(expectedLimit);
        });

        it("Should store factory address correctly", async function () {
            const factoryAddress = await factory.getAddress();
            expect(await token.factoryAddress()).to.equal(factoryAddress);
        });
    });

    describe("Integration with Existing Features", function () {
        it("Should emit TokenDeployed event with anti-rug protection flag", async function () {
            // Deploy another token to test the event
            const tx = factory.connect(creator).deployToken("TestToken2", "TEST2", 500000, { value: deploymentFee });
            
            await expect(tx).to.emit(factory, "TokenDeployed");
            
            // Verify the event has the anti-rug protection flag
            const receipt = await (await tx).wait();
            const event = receipt.logs.find(log => log.eventName === "TokenDeployed");
            expect(event.args[5]).to.equal(true); // hasAntiRugProtection should be true
        });

        it("Should work with approval-based transfers", async function () {
            const totalTokens = await token.totalSupply();
            const maxTransfer = totalTokens * 5n / 100n;
            
            // Creator approves user1 to spend tokens
            await token.connect(creator).approve(user1.address, maxTransfer);
            
            // User1 transfers from creator to user2 (within limits)
            await expect(
                token.connect(user1).transferFrom(creator.address, user2.address, maxTransfer)
            ).to.not.be.reverted;
            
            expect(await token.balanceOf(user2.address)).to.equal(maxTransfer);
        });
    });
});

// Helper for any value matching
const anyValue = {
    asymmetricMatch: () => true,
    jasmineToString: () => '<Any Value>'
};
