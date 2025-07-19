import { expect } from "chai";
import { ethers } from "hardhat";
import { PumpFunToken, PumpFunFactoryLite, PumpFunGovernance, PumpFunGovernanceAirdrop } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Integration Tests", function () {
    let factory: PumpFunFactoryLite;
    let governance: PumpFunGovernance;
    let airdropContract: PumpFunGovernanceAirdrop;
    let token: PumpFunToken;
    
    let owner: SignerWithAddress;
    let creator: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let user3: SignerWithAddress;

    const TOKEN_NAME = "TestMeme";
    const TOKEN_SYMBOL = "MEME";
    const INITIAL_SUPPLY = 1000000;
    const LOCK_PERIOD = 30;

    beforeEach(async function () {
        [owner, creator, user1, user2, user3] = await ethers.getSigners();

        // Deploy Factory
        const FactoryContract = await ethers.getContractFactory("PumpFunFactoryLite");
        factory = await FactoryContract.deploy();
        await factory.waitForDeployment();

        // Deploy Airdrop Contract
        const AirdropContract = await ethers.getContractFactory("PumpFunGovernanceAirdrop");
        airdropContract = await AirdropContract.deploy();
        await airdropContract.waitForDeployment();

        // Deploy Governance Contract
        const GovernanceContract = await ethers.getContractFactory("PumpFunGovernance");
        governance = await GovernanceContract.deploy(
            await airdropContract.getAddress(),
            await factory.getAddress()
        );
        await governance.waitForDeployment();

        // Set up factory with governance and airdrop
        await factory.setAirdropManager(await airdropContract.getAddress());
        await factory.setGovernanceManager(await governance.getAddress());

        // Deploy a token through factory
        const deploymentFee = await factory.etherFee();
        const tx = await factory.connect(creator).deployToken(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            INITIAL_SUPPLY,
            LOCK_PERIOD,
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

    describe("Full Token Lifecycle", function () {
        it("Should deploy token with all integrations working", async function () {
            // Verify token is properly deployed
            expect(await token.name()).to.equal(TOKEN_NAME);
            expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
            expect(await token.owner()).to.equal(creator.address);

            // Verify governance is set
            expect(await token.governanceContract()).to.equal(await governance.getAddress());

            // Verify factory tracking
            expect(await factory.isDeployedToken(await token.getAddress())).to.be.true;
            expect(await factory.totalTokensDeployed()).to.equal(1);

            // Verify initial supply distribution
            const totalSupply = await token.totalSupply();
            const creatorBalance = await token.balanceOf(creator.address);
            const contractBalance = await token.balanceOf(await token.getAddress());

            expect(creatorBalance).to.equal(totalSupply * 10n / 100n); // 10% to creator
            expect(contractBalance).to.equal(totalSupply * 90n / 100n); // 90% to contract
        });

        it("Should handle token locking and unlocking correctly", async function () {
            const lockAmount = ethers.parseEther("1000");
            const lockDuration = 7 * 24 * 60 * 60; // 7 days

            // Transfer tokens to user1
            await token.connect(creator).transfer(user1.address, lockAmount);

            // User1 locks tokens
            await token.connect(user1).lockTokens(lockAmount, lockDuration);

            // Verify tokens are locked
            const lockInfo = await token.getLockedTokens(user1.address);
            expect(lockInfo.amount).to.equal(lockAmount);
            expect(lockInfo.isLocked).to.be.true;

            // Try to transfer locked tokens (should fail)
            await expect(
                token.connect(user1).transfer(user2.address, lockAmount)
            ).to.be.revertedWithCustomError(token, "TransferLocked");

            // Fast forward time
            await time.increase(lockDuration + 1);

            // Unlock tokens
            await token.connect(user1).unlockTokens();

            // Verify tokens are unlocked
            const unlockInfo = await token.getLockedTokens(user1.address);
            expect(unlockInfo.isLocked).to.be.false;

            // Now transfer should work
            await token.connect(user1).transfer(user2.address, lockAmount);
            expect(await token.balanceOf(user2.address)).to.equal(lockAmount);
        });

        it("Should enforce transfer restrictions properly", async function () {
            const maxTransferAmount = await token.maxTransferAmount();
            const transferAmount = maxTransferAmount / 2n;

            // Transfer tokens to user1
            await token.connect(creator).transfer(user1.address, transferAmount * 3n);

            // First transfer should work
            await token.connect(user1).transfer(user2.address, transferAmount);
            expect(await token.balanceOf(user2.address)).to.equal(transferAmount);

            // Second transfer immediately should fail due to cooldown
            await expect(
                token.connect(user1).transfer(user3.address, transferAmount)
            ).to.be.revertedWithCustomError(token, "TransferLocked");

            // Wait for cooldown period
            await time.increase(3600 + 1); // 1 hour + 1 second

            // Now transfer should work
            await token.connect(user1).transfer(user3.address, transferAmount);
            expect(await token.balanceOf(user3.address)).to.equal(transferAmount);
        });
    });

    describe("Governance Integration", function () {
        beforeEach(async function () {
            // Transfer some tokens to users for governance participation
            const transferAmount = ethers.parseEther("10000");
            await token.connect(creator).transfer(user1.address, transferAmount);
            await token.connect(creator).transfer(user2.address, transferAmount);
            await token.connect(creator).transfer(user3.address, transferAmount);
        });

        it("Should create and execute governance proposals", async function () {
            const proposalDescription = "Test proposal for airdrop";
            const recipients = [user1.address, user2.address];
            const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];

            // Create proposal
            const proposalId = await governance.connect(user1).createProposal.staticCall(
                await token.getAddress(),
                proposalDescription,
                2, // AIRDROP type
                0,
                recipients,
                amounts
            );

            await governance.connect(user1).createProposal(
                await token.getAddress(),
                proposalDescription,
                2, // AIRDROP type
                0,
                recipients,
                amounts
            );

            // Vote on proposal
            await governance.connect(user1).vote(proposalId, true);
            await governance.connect(user2).vote(proposalId, true);
            await governance.connect(user3).vote(proposalId, true);

            // Fast forward past voting period
            await time.increase(7 * 24 * 60 * 60 + 1); // 7 days + 1 second

            // Execute proposal
            await governance.connect(user1).executeProposal(proposalId);

            // Verify airdrop was executed
            const airdropBalance = await token.balanceOf(await airdropContract.getAddress());
            const totalAirdropAmount = amounts[0] + amounts[1];
            expect(airdropBalance).to.equal(totalAirdropAmount);
        });

        it("Should reject proposals with insufficient votes", async function () {
            const proposalDescription = "Test proposal that will fail";
            const recipients = [user1.address];
            const amounts = [ethers.parseEther("100")];

            // Create proposal
            const proposalId = await governance.connect(user1).createProposal.staticCall(
                await token.getAddress(),
                proposalDescription,
                2, // AIRDROP type
                0,
                recipients,
                amounts
            );

            await governance.connect(user1).createProposal(
                await token.getAddress(),
                proposalDescription,
                2, // AIRDROP type
                0,
                recipients,
                amounts
            );

            // Only one vote (insufficient)
            await governance.connect(user1).vote(proposalId, true);

            // Fast forward past voting period
            await time.increase(7 * 24 * 60 * 60 + 1);

            // Try to execute (should fail)
            await expect(
                governance.connect(user1).executeProposal(proposalId)
            ).to.be.revertedWithCustomError(governance, "ProposalFailed");
        });
    });

    describe("Emergency Scenarios", function () {
        it("Should handle emergency pause correctly", async function () {
            const transferAmount = ethers.parseEther("1000");
            
            // Normal transfer should work
            await token.connect(creator).transfer(user1.address, transferAmount);
            expect(await token.balanceOf(user1.address)).to.equal(transferAmount);

            // Emergency pause
            await token.connect(creator).emergencyPause();

            // Transfers should fail when paused
            await expect(
                token.connect(user1).transfer(user2.address, transferAmount)
            ).to.be.revertedWithCustomError(token, "EnforcedPause");

            // Unpause
            await token.connect(creator).emergencyUnpause();

            // Transfers should work again
            await token.connect(user1).transfer(user2.address, transferAmount);
            expect(await token.balanceOf(user2.address)).to.equal(transferAmount);
        });

        it("Should handle stability mechanisms", async function () {
            const mintAmount = ethers.parseEther("1000");
            const burnAmount = ethers.parseEther("500");
            const highPrice = ethers.parseEther("2"); // Above target
            const lowPrice = ethers.parseEther("0.5"); // Below target

            const initialSupply = await token.totalSupply();

            // Test stability minting (when price is high)
            await token.connect(creator).stabilityMint(mintAmount, highPrice);
            const supplyAfterMint = await token.totalSupply();
            expect(supplyAfterMint).to.equal(initialSupply + mintAmount);

            // Test stability burning (when price is low)
            await token.connect(creator).stabilityBurn(burnAmount, lowPrice);
            const supplyAfterBurn = await token.totalSupply();
            expect(supplyAfterBurn).to.equal(supplyAfterMint - burnAmount);
        });
    });

    describe("Multi-Token Scenarios", function () {
        let token2: PumpFunToken;

        beforeEach(async function () {
            // Deploy second token
            const deploymentFee = await factory.etherFee();
            const tx = await factory.connect(user1).deployToken(
                "SecondToken",
                "TK2", 
                500000,
                LOCK_PERIOD,
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

            const parsedEvent = factory.interface.parseLog(event!);
            const token2Address = parsedEvent?.args[2];
            token2 = await ethers.getContractAt("PumpFunToken", token2Address);
        });

        it("Should track multiple tokens correctly", async function () {
            expect(await factory.totalTokensDeployed()).to.equal(2);

            // Check first token (created by creator)
            const creatorTokens = await factory.creatorTokens(creator.address, 0);
            expect(creatorTokens).to.equal(await token.getAddress());

            // Check second token (created by user1)
            const user1Tokens = await factory.creatorTokens(user1.address, 0);
            expect(user1Tokens).to.equal(await token2.getAddress());

            // Both should be tracked as deployed tokens
            expect(await factory.isDeployedToken(await token.getAddress())).to.be.true;
            expect(await factory.isDeployedToken(await token2.getAddress())).to.be.true;
        });

        it("Should handle governance for multiple tokens", async function () {
            // Both tokens should have governance set
            expect(await token.governanceContract()).to.equal(await governance.getAddress());
            expect(await token2.governanceContract()).to.equal(await governance.getAddress());

            // Should be able to create proposals for different tokens
            const recipients = [user2.address];
            const amounts = [ethers.parseEther("100")];

            // Transfer some tokens for voting power
            await token.connect(creator).transfer(user3.address, ethers.parseEther("10000"));
            await token2.connect(user1).transfer(user3.address, ethers.parseEther("10000"));

            // Create proposal for first token
            const proposal1Id = await governance.connect(user3).createProposal.staticCall(
                await token.getAddress(),
                "Airdrop for token 1",
                2,
                0,
                recipients,
                amounts
            );

            // Create proposal for second token
            const proposal2Id = await governance.connect(user3).createProposal.staticCall(
                await token2.getAddress(),
                "Airdrop for token 2",
                2,
                0,
                recipients,
                amounts
            );

            expect(proposal1Id).to.not.equal(proposal2Id);
        });
    });

    describe("Edge Cases and Error Handling", function () {
        it("Should handle zero amount transfers gracefully", async function () {
            // Zero amount transfers should be allowed but not change balances
            const initialBalance = await token.balanceOf(user1.address);
            await token.connect(creator).transfer(user1.address, 0);
            expect(await token.balanceOf(user1.address)).to.equal(initialBalance);
        });

        it("Should prevent governance proposals with invalid parameters", async function () {
            // Transfer tokens for voting power
            await token.connect(creator).transfer(user1.address, ethers.parseEther("10000"));

            // Try to create proposal with mismatched arrays
            const recipients = [user2.address, user3.address];
            const amounts = [ethers.parseEther("100")]; // Shorter array

            await expect(
                governance.connect(user1).createProposal(
                    await token.getAddress(),
                    "Invalid proposal",
                    2,
                    0,
                    recipients,
                    amounts
                )
            ).to.be.revertedWithCustomError(governance, "InvalidArrayLengths");
        });

        it("Should handle max supply limits correctly", async function () {
            const MAX_SUPPLY = await token.MAX_SUPPLY();
            const currentSupply = await token.totalSupply();
            const maxMintAmount = MAX_SUPPLY - currentSupply;

            // Should be able to mint up to max supply
            await token.connect(creator).stabilityMint(maxMintAmount, ethers.parseEther("2"));
            expect(await token.totalSupply()).to.equal(MAX_SUPPLY);

            // Should not be able to mint beyond max supply
            await expect(
                token.connect(creator).stabilityMint(1, ethers.parseEther("2"))
            ).to.be.revertedWithCustomError(token, "InvalidMintAmount");
        });
    });

    describe("Gas Usage and Performance", function () {
        it("Should have reasonable gas costs for token deployment", async function () {
            const deploymentFee = await factory.etherFee();
            
            const tx = await factory.connect(user1).deployToken(
                "GasTest",
                "GAS",
                1000000,
                30,
                { value: deploymentFee }
            );
            
            const receipt = await tx.wait();
            
            // Gas usage should be reasonable (less than 3M gas)
            expect(receipt!.gasUsed).to.be.lt(3000000);
        });

        it("Should have reasonable gas costs for transfers", async function () {
            const transferAmount = ethers.parseEther("1000");
            
            // Transfer to user1 first
            const setupTx = await token.connect(creator).transfer(user1.address, transferAmount);
            const setupReceipt = await setupTx.wait();
            
            // Then transfer from user1 to user2
            const transferTx = await token.connect(user1).transfer(user2.address, transferAmount);
            const transferReceipt = await transferTx.wait();
            
            // Transfer gas should be reasonable (less than 200k gas)
            expect(transferReceipt!.gasUsed).to.be.lt(200000);
        });
    });
});
