const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainCraftToken (Simplified)", function () {
    let pumpFunToken;
    let owner, addr1, addr2;
    let tokenName = "Test Token";
    let tokenSymbol = "TEST";
    let totalSupply = 1000000; // 1M tokens

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        
        const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
        pumpFunToken = await ChainCraftToken.deploy(
            tokenName,
            tokenSymbol,
            totalSupply,
            owner.address
        );
        await pumpFunToken.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            expect(await pumpFunToken.name()).to.equal(tokenName);
            expect(await pumpFunToken.symbol()).to.equal(tokenSymbol);
        });

        it("Should set the correct decimals", async function () {
            expect(await pumpFunToken.decimals()).to.equal(18);
        });

        it("Should mint all tokens to the creator", async function () {
            const expectedTotalSupply = ethers.parseEther(totalSupply.toString());
            expect(await pumpFunToken.totalSupply()).to.equal(expectedTotalSupply);
            expect(await pumpFunToken.balanceOf(owner.address)).to.equal(expectedTotalSupply);
        });

        it("Should set the correct owner", async function () {
            expect(await pumpFunToken.owner()).to.equal(owner.address);
        });

        it("Should emit TokenCreated event", async function () {
            const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
            const expectedTotalSupply = ethers.parseEther(totalSupply.toString());
            
            const newToken = await ChainCraftToken.deploy(tokenName, tokenSymbol, totalSupply, owner.address);
            const receipt = await newToken.deploymentTransaction().wait();
            
            // Check if TokenCreated event was emitted
            const tokenCreatedEvent = receipt.logs.find(
                log => log.eventName === "TokenCreated"
            );
            
            expect(tokenCreatedEvent).to.not.be.undefined;
            expect(tokenCreatedEvent.args[0]).to.equal(owner.address);
            expect(tokenCreatedEvent.args[1]).to.equal(expectedTotalSupply);
        });
    });

    describe("Deployment Validation", function () {
        const ChainCraftToken = ethers.getContractFactory("ChainCraftToken");

        it("Should revert with empty name", async function () {
            const factory = await ChainCraftToken;
            await expect(
                factory.deploy("", tokenSymbol, totalSupply, owner.address)
            ).to.be.revertedWithCustomError(factory, "ChainCraftToken__InvalidName");
        });

        it("Should revert with empty symbol", async function () {
            const factory = await ChainCraftToken;
            await expect(
                factory.deploy(tokenName, "", totalSupply, owner.address)
            ).to.be.revertedWithCustomError(factory, "ChainCraftToken__InvalidSymbol");
        });

        it("Should revert with zero total supply", async function () {
            const factory = await ChainCraftToken;
            await expect(
                factory.deploy(tokenName, tokenSymbol, 0, owner.address)
            ).to.be.revertedWithCustomError(factory, "ChainCraftToken__ZeroAmount");
        });

        it("Should revert with zero address creator", async function () {
            const factory = await ChainCraftToken;
            await expect(
                factory.deploy(tokenName, tokenSymbol, totalSupply, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(factory, "OwnableInvalidOwner");
        });
    });

    describe("Token Transfers", function () {
        const transferAmount = ethers.parseEther("1000");

        it("Should allow owner to transfer tokens", async function () {
            await expect(pumpFunToken.transfer(addr1.address, transferAmount))
                .to.changeTokenBalances(
                    pumpFunToken,
                    [owner, addr1],
                    [-transferAmount, transferAmount]
                );
        });

        it("Should allow approved transfers", async function () {
            await pumpFunToken.approve(addr1.address, transferAmount);
            
            await expect(
                pumpFunToken.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
            ).to.changeTokenBalances(
                pumpFunToken,
                [owner, addr2],
                [-transferAmount, transferAmount]
            );
        });

        it("Should emit Transfer events", async function () {
            await expect(pumpFunToken.transfer(addr1.address, transferAmount))
                .to.emit(pumpFunToken, "Transfer")
                .withArgs(owner.address, addr1.address, transferAmount);
        });
    });

    describe("Token Burning", function () {
        const burnAmount = ethers.parseEther("1000");

        it("Should allow owner to burn tokens", async function () {
            const initialSupply = await pumpFunToken.totalSupply();
            const initialBalance = await pumpFunToken.balanceOf(owner.address);

            await pumpFunToken.burn(burnAmount);

            expect(await pumpFunToken.totalSupply()).to.equal(initialSupply - burnAmount);
            expect(await pumpFunToken.balanceOf(owner.address)).to.equal(initialBalance - burnAmount);
        });

        it("Should allow burning from approved allowance", async function () {
            await pumpFunToken.approve(addr1.address, burnAmount);
            
            const initialSupply = await pumpFunToken.totalSupply();
            
            await pumpFunToken.connect(addr1).burnFrom(owner.address, burnAmount);
            
            expect(await pumpFunToken.totalSupply()).to.equal(initialSupply - burnAmount);
        });

        it("Should emit Transfer event to zero address when burning", async function () {
            await expect(pumpFunToken.burn(burnAmount))
                .to.emit(pumpFunToken, "Transfer")
                .withArgs(owner.address, ethers.ZeroAddress, burnAmount);
        });
    });

    describe("Ownership", function () {
        it("Should allow owner to transfer ownership", async function () {
            await pumpFunToken.transferOwnership(addr1.address);
            expect(await pumpFunToken.owner()).to.equal(addr1.address);
        });

        it("Should allow owner to renounce ownership", async function () {
            await pumpFunToken.renounceOwnership();
            expect(await pumpFunToken.owner()).to.equal(ethers.ZeroAddress);
        });

        it("Should not allow non-owner to transfer ownership", async function () {
            await expect(
                pumpFunToken.connect(addr1).transferOwnership(addr2.address)
            ).to.be.revertedWithCustomError(pumpFunToken, "OwnableUnauthorizedAccount");
        });
    });

    describe("Standard ERC20 Compliance", function () {
        it("Should have correct total supply", async function () {
            const expectedSupply = ethers.parseEther(totalSupply.toString());
            expect(await pumpFunToken.totalSupply()).to.equal(expectedSupply);
        });

        it("Should allow setting and checking allowances", async function () {
            const allowanceAmount = ethers.parseEther("5000");
            
            await pumpFunToken.approve(addr1.address, allowanceAmount);
            expect(await pumpFunToken.allowance(owner.address, addr1.address)).to.equal(allowanceAmount);
        });

        it("Should emit Approval events", async function () {
            const allowanceAmount = ethers.parseEther("5000");
            
            await expect(pumpFunToken.approve(addr1.address, allowanceAmount))
                .to.emit(pumpFunToken, "Approval")
                .withArgs(owner.address, addr1.address, allowanceAmount);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle maximum token supply correctly", async function () {
            const maxSupply = 1000000000; // 1B tokens
            const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
            const maxToken = await ChainCraftToken.deploy("Max Token", "MAX", maxSupply, owner.address);
            await maxToken.waitForDeployment();
            
            const expectedSupply = ethers.parseEther(maxSupply.toString());
            expect(await maxToken.totalSupply()).to.equal(expectedSupply);
            expect(await maxToken.balanceOf(owner.address)).to.equal(expectedSupply);
        });

        it("Should handle minimum token supply correctly", async function () {
            const minSupply = 1000; // 1K tokens
            const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
            const minToken = await ChainCraftToken.deploy("Min Token", "MIN", minSupply, owner.address);
            await minToken.waitForDeployment();
            
            const expectedSupply = ethers.parseEther(minSupply.toString());
            expect(await minToken.totalSupply()).to.equal(expectedSupply);
            expect(await minToken.balanceOf(owner.address)).to.equal(expectedSupply);
        });
    });
});
