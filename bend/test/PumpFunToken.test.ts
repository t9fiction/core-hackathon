import { expect } from "chai";
import { ethers } from "hardhat";
import { PumpFunToken, PumpFunFactoryLite } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("PumpFunToken", function () {
    let token: PumpFunToken;
    let factory: PumpFunFactoryLite;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let governance: SignerWithAddress;
    let airdropContract: SignerWithAddress;

    const INITIAL_SUPPLY = 1000000;
    const TOKEN_NAME = "TestToken";
    const TOKEN_SYMBOL = "TEST";

    beforeEach(async function () {
        [owner, user1, user2, governance, airdropContract] = await ethers.getSigners();

        // Deploy factory first
        const FactoryContract = await ethers.getContractFactory("PumpFunFactoryLite");
        factory = await FactoryContract.deploy();
        await factory.waitForDeployment();

        // Set airdrop contract in factory
        await factory.setAirdropManager(airdropContract.address);

        // Deploy token through factory
        const deploymentFee = await factory.etherFee();
        const tx = await factory.connect(owner).deployToken(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            INITIAL_SUPPLY,
            30,
            { value: deploymentFee }
        );
        
        const receipt = await tx.wait();
        const event = receipt?.logs.find(log => {
            try {
                const parsed = factory.interface.parseLog(log);
                return parsed?.name === "TokenDeployed";
            } catch {
                return false;
            }
        });
        
        if (!event) throw new Error("TokenDeployed event not found");
        const parsedEvent = factory.interface.parseLog(event);
        const tokenAddress = parsedEvent?.args[2];

        token = await ethers.getContractAt("PumpFunToken", tokenAddress);
    });

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            expect(await token.name()).to.equal(TOKEN_NAME);
            expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
        });

        it("Should set the correct owner", async function () {
            expect(await token.owner()).to.equal(owner.address);
        });

        it("Should mint the correct initial supply distribution", async function () {
            const totalSupply = await token.totalSupply();
            const expectedSupply = ethers.parseUnits(INITIAL_SUPPLY.toString(), 18);
            expect(totalSupply).to.equal(expectedSupply);

            // Check creator gets 10%
            const creatorBalance = await token.balanceOf(owner.address);
            const expectedCreatorBalance = expectedSupply * 10n / 100n;
            expect(creatorBalance).to.equal(expectedCreatorBalance);

            // Check contract gets 90% (20% liquidity + 70% community)
            const contractBalance = await token.balanceOf(await token.getAddress());
            const expectedContractBalance = expectedSupply * 90n / 100n;
            expect(contractBalance).to.equal(expectedContractBalance);
        });

        it("Should set correct max transfer amount and max holding", async function () {
            const totalSupply = await token.totalSupply();
            const expectedMaxTransfer = totalSupply / 100n; // 1%
            const expectedMaxHolding = totalSupply * 5n / 100n; // 5%

            expect(await token.maxTransferAmount()).to.equal(expectedMaxTransfer);
            expect(await token.maxHolding()).to.equal(expectedMaxHolding);
        });

        it("Should whitelist factory and airdrop contract", async function () {
            expect(await token.isWhitelisted(await factory.getAddress())).to.be.true;
            expect(await token.isWhitelisted(airdropContract.address)).to.be.true;
        });

        it("Should revert with invalid parameters", async function () {
            const FactoryContract = await ethers.getContractFactory("PumpFunFactoryLite");
            const testFactory = await FactoryContract.deploy();
            await testFactory.setAirdropManager(airdropContract.address);
            
            const deploymentFee = await testFactory.etherFee();

            // Test empty name - this will be caught by factory validation
            await expect(
                testFactory.connect(owner).deployToken("", TOKEN_SYMBOL, INITIAL_SUPPLY, 30, { value: deploymentFee })
            ).to.be.revertedWithCustomError(testFactory, "PumpFunFactoryLite__EmptyStringParameter");

            // Test empty symbol - this will be caught by factory validation
            await expect(
                testFactory.connect(owner).deployToken(TOKEN_NAME, "", INITIAL_SUPPLY, 30, { value: deploymentFee })
            ).to.be.revertedWithCustomError(testFactory, "PumpFunFactoryLite__EmptyStringParameter");

            // Test zero initial supply - this will be caught by factory validation
            await expect(
                testFactory.connect(owner).deployToken(TOKEN_NAME, TOKEN_SYMBOL, 0, 30, { value: deploymentFee })
            ).to.be.revertedWithCustomError(testFactory, "PumpFunFactoryLite__TotalSupplyTooLow");
        });
    });

    describe("Token Locking", function () {
        it("Should allow users to lock tokens", async function () {
            const lockAmount = ethers.parseEther("1000");
            const lockDuration = 7 * 24 * 60 * 60; // 7 days

            // Transfer some tokens to user1 first
            await token.connect(owner).transfer(user1.address, lockAmount);

            await expect(token.connect(user1).lockTokens(lockAmount, lockDuration))
                .to.emit(token, "TokensLocked")
                .withArgs(user1.address, lockAmount, anyValue);

            const lockInfo = await token.getLockedTokens(user1.address);
            expect(lockInfo.amount).to.equal(lockAmount);
            expect(lockInfo.isLocked).to.be.true;
        });

        it("Should prevent transfers of locked tokens", async function () {
            const lockAmount = ethers.parseEther("1000");
            const lockDuration = 7 * 24 * 60 * 60; // 7 days

            await token.connect(owner).transfer(user1.address, lockAmount);
            await token.connect(user1).lockTokens(lockAmount, lockDuration);

            // Try to transfer locked tokens
            await expect(
                token.connect(user1).transfer(user2.address, lockAmount)
            ).to.be.revertedWithCustomError(token, "TransferLocked");
        });

        it("Should allow unlocking tokens after lock period", async function () {
            const lockAmount = ethers.parseEther("1000");
            const lockDuration = 7 * 24 * 60 * 60; // 7 days

            await token.connect(owner).transfer(user1.address, lockAmount);
            await token.connect(user1).lockTokens(lockAmount, lockDuration);

            // Fast forward time
            await time.increase(lockDuration + 1);

            await expect(token.connect(user1).unlockTokens())
                .to.emit(token, "TokensUnlocked")
                .withArgs(user1.address, lockAmount);

            const lockInfo = await token.getLockedTokens(user1.address);
            expect(lockInfo.isLocked).to.be.false;
        });

        it("Should revert when trying to unlock before lock period expires", async function () {
            const lockAmount = ethers.parseEther("1000");
            const lockDuration = 7 * 24 * 60 * 60; // 7 days

            await token.connect(owner).transfer(user1.address, lockAmount);
            await token.connect(user1).lockTokens(lockAmount, lockDuration);

            await expect(
                token.connect(user1).unlockTokens()
            ).to.be.revertedWithCustomError(token, "LockNotExpired");
        });

        it("Should revert when trying to lock with invalid duration", async function () {
            const lockAmount = ethers.parseEther("1000");
            
            await token.connect(owner).transfer(user1.address, lockAmount);

            // Test too short duration
            const shortDuration = 23 * 60 * 60; // 23 hours
            await expect(
                token.connect(user1).lockTokens(lockAmount, shortDuration)
            ).to.be.revertedWithCustomError(token, "InvalidLockDuration");

            // Test too long duration
            const longDuration = 366 * 24 * 60 * 60; // 366 days
            await expect(
                token.connect(user1).lockTokens(lockAmount, longDuration)
            ).to.be.revertedWithCustomError(token, "InvalidLockDuration");
        });
    });

    describe("Transfer Restrictions", function () {
        it("Should enforce max transfer amount for non-whitelisted users", async function () {
            const maxTransferAmount = await token.maxTransferAmount();
            const validAmount = maxTransferAmount;
            const excessiveAmount = maxTransferAmount + 1n;

            // Give user1 enough tokens but within max holding
            await token.connect(owner).transfer(user1.address, validAmount * 2n);

            // First, transfer a valid amount
            await token.connect(user1).transfer(user2.address, validAmount);
            
            // Wait for cooldown
            await time.increase(3601); // 1 hour + 1 second

            // Now try excessive amount - should fail
            await expect(
                token.connect(user1).transfer(user2.address, excessiveAmount)
            ).to.be.revertedWithCustomError(token, "ExceedsMaxTransferAmount");
        });

        it("Should enforce max holding limit for non-whitelisted users", async function () {
            const maxHolding = await token.maxHolding();
            const maxTransferAmount = await token.maxTransferAmount();
            const excessiveAmount = maxHolding + 1n;

            // Give user1 enough tokens
            await token.connect(owner).transfer(user1.address, maxTransferAmount);

            await expect(
                token.connect(user1).transfer(user2.address, excessiveAmount)
            ).to.be.revertedWithCustomError(token, "ExceedsMaxHolding");
        });

        it("Should enforce transfer cooldown for non-whitelisted users", async function () {
            const transferAmount = ethers.parseEther("1000");
            
            await token.connect(owner).transfer(user1.address, transferAmount * 2n);
            
            // First transfer should work
            await token.connect(user1).transfer(user2.address, transferAmount);
            
            // Second transfer immediately should fail
            await expect(
                token.connect(user1).transfer(user2.address, transferAmount)
            ).to.be.revertedWithCustomError(token, "TransferLocked");
        });

        it("Should allow whitelisted users to bypass restrictions", async function () {
            const maxTransferAmount = await token.maxTransferAmount();
            const excessiveAmount = maxTransferAmount + 1n;

            // Whitelist user1
            await token.connect(owner).setWhitelisted(user1.address, true);
            
            await token.connect(owner).transfer(user1.address, excessiveAmount);
            
            // Should work because user1 is whitelisted
            await expect(
                token.connect(user1).transfer(user2.address, excessiveAmount)
            ).to.not.be.reverted;
        });

        it("Should allow owner to disable transfer limits", async function () {
            const maxTransferAmount = await token.maxTransferAmount();
            const excessiveAmount = maxTransferAmount + 1n;

            await token.connect(owner).transfer(user1.address, excessiveAmount);
            
            // Disable transfer limits
            await token.connect(owner).setTransferLimitsEnabled(false);
            
            // Should work now
            await expect(
                token.connect(user1).transfer(user2.address, excessiveAmount)
            ).to.not.be.reverted;
        });
    });

    describe("Stability Functions", function () {
        it("Should allow stability minting when conditions are met", async function () {
            // First burn some tokens to make room for minting
            const burnAmount = ethers.parseEther("5000");
            const mintAmount = ethers.parseEther("1000");
            
            // Burn first to create capacity
            await token.connect(owner).stabilityBurn(burnAmount, ethers.parseEther("0.5"));
            
            const currentPrice = ethers.parseEther("2"); // Above target price
            const targetPrice = await token.targetPrice();
            
            expect(currentPrice).to.be.gt(targetPrice);
            
            await expect(token.connect(owner).stabilityMint(mintAmount, currentPrice))
                .to.emit(token, "StabilityMint")
                .withArgs(mintAmount, currentPrice);
        });

        it("Should not mint when price is not above target", async function () {
            const mintAmount = ethers.parseEther("1000");
            const currentPrice = ethers.parseEther("0.5"); // Below target price
            
            // This should not revert, but should also not mint
            const totalSupplyBefore = await token.totalSupply();
            await token.connect(owner).stabilityMint(mintAmount, currentPrice);
            const totalSupplyAfter = await token.totalSupply();
            
            // Supply should not change when price conditions not met
            expect(totalSupplyAfter).to.equal(totalSupplyBefore);
        });

        it("Should allow stability burning when price is below target", async function () {
            const burnAmount = ethers.parseEther("1000");
            const currentPrice = ethers.parseEther("0.5"); // Below target price
            
            await expect(token.connect(owner).stabilityBurn(burnAmount, currentPrice))
                .to.emit(token, "StabilityBurn")
                .withArgs(burnAmount, currentPrice);
        });

        it("Should revert stability functions when disabled", async function () {
            const amount = ethers.parseEther("1000");
            const currentPrice = ethers.parseEther("2");
            
            // Disable minting
            await token.connect(owner).setMintingEnabled(false);
            await expect(
                token.connect(owner).stabilityMint(amount, currentPrice)
            ).to.be.revertedWithCustomError(token, "MintingPaused");
            
            // Disable burning
            await token.connect(owner).setBurningEnabled(false);
            await expect(
                token.connect(owner).stabilityBurn(amount, currentPrice)
            ).to.be.revertedWithCustomError(token, "BurningPaused");
        });
    });

    describe("Governance Functions", function () {
        beforeEach(async function () {
            // Set governance contract
            await factory.connect(owner).setGovernanceManager(governance.address);
            await factory.connect(owner).updateGovernanceForTokens([await token.getAddress()]);
        });

        it("Should allow governance contract to trigger airdrops", async function () {
            const recipients = [user1.address, user2.address];
            const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
            const totalAmount = amounts[0] + amounts[1];

            await expect(
                token.connect(governance).transferAirdrop(recipients, amounts)
            ).to.emit(token, "AirdropTriggered")
            .withArgs(airdropContract.address, totalAmount);
        });

        it("Should revert airdrop from non-governance address", async function () {
            const recipients = [user1.address, user2.address];
            const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];

            await expect(
                token.connect(user1).transferAirdrop(recipients, amounts)
            ).to.be.revertedWithCustomError(token, "OnlyGovernance");
        });
    });

    describe("Emergency Functions", function () {
        it("Should allow owner to pause and unpause", async function () {
            await token.connect(owner).emergencyPause();
            expect(await token.paused()).to.be.true;

            // Should not be able to transfer when paused
            const transferAmount = ethers.parseEther("100");
            await expect(
                token.connect(owner).transfer(user1.address, transferAmount)
            ).to.be.revertedWithCustomError(token, "EnforcedPause");

            await token.connect(owner).emergencyUnpause();
            expect(await token.paused()).to.be.false;

            // Should be able to transfer when unpaused
            await expect(
                token.connect(owner).transfer(user1.address, transferAmount)
            ).to.not.be.reverted;
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to update max transfer amount", async function () {
            const newAmount = ethers.parseEther("5000");
            const oldAmount = await token.maxTransferAmount();

            await expect(token.connect(owner).setMaxTransferAmount(newAmount))
                .to.emit(token, "MaxTransferAmountUpdated")
                .withArgs(oldAmount, newAmount);

            expect(await token.maxTransferAmount()).to.equal(newAmount);
        });

        it("Should allow owner to update max holding", async function () {
            const newAmount = ethers.parseEther("10000");
            const oldAmount = await token.maxHolding();

            await expect(token.connect(owner).setMaxHolding(newAmount))
                .to.emit(token, "MaxHoldingUpdated")
                .withArgs(oldAmount, newAmount);

            expect(await token.maxHolding()).to.equal(newAmount);
        });

        it("Should not allow non-owner to call admin functions", async function () {
            await expect(
                token.connect(user1).setMaxTransferAmount(ethers.parseEther("5000"))
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");

            await expect(
                token.connect(user1).setMaxHolding(ethers.parseEther("10000"))
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");

            await expect(
                token.connect(user1).setWhitelisted(user2.address, true)
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        });
    });

    describe("View Functions", function () {
        it("Should return correct available balance", async function () {
            const totalBalance = ethers.parseEther("1000");
            const lockAmount = ethers.parseEther("300");
            const lockDuration = 7 * 24 * 60 * 60;

            await token.connect(owner).transfer(user1.address, totalBalance);
            await token.connect(user1).lockTokens(lockAmount, lockDuration);

            const availableBalance = await token.getAvailableBalance(user1.address);
            expect(availableBalance).to.equal(totalBalance - lockAmount);
        });

        it("Should return full balance when no tokens are locked", async function () {
            const totalBalance = ethers.parseEther("1000");

            await token.connect(owner).transfer(user1.address, totalBalance);

            const availableBalance = await token.getAvailableBalance(user1.address);
            expect(availableBalance).to.equal(totalBalance);
        });
    });

    describe("Contract Approvals", function () {
        it("Should allow owner to approve contract spenders", async function () {
            const spender = user1.address;
            const amount = ethers.parseEther("1000");

            await expect(
                token.connect(owner).approveContractSpender(spender, amount)
            ).to.emit(token, "ContractApprovedSpender")
            .withArgs(spender, amount);

            const allowance = await token.allowance(await token.getAddress(), spender);
            expect(allowance).to.equal(amount);
        });

        it("Should revert with zero address or amount", async function () {
            await expect(
                token.connect(owner).approveContractSpender(ethers.ZeroAddress, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(token, "ZeroAddress");

            await expect(
                token.connect(owner).approveContractSpender(user1.address, 0)
            ).to.be.revertedWithCustomError(token, "ZeroAmount");
        });
    });
});
