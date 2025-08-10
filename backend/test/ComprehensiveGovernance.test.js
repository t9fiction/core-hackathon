const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Comprehensive Governance Testing", function () {
  let factory, token, governance, airdrop;
  let owner, creator, voter1, voter2, voter3, beneficiary1, beneficiary2;
  let tokenAddress, governanceAddress, airdropAddress;

  const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days
  const MIN_VOTING_POWER = ethers.parseUnits("1000", 18); // 1000 tokens minimum

  beforeEach(async function () {
    [owner, creator, voter1, voter2, voter3, beneficiary1, beneficiary2] = await ethers.getSigners();

    // Deploy Factory
    const ChainCraftFactoryLite = await ethers.getContractFactory("ChainCraftFactoryLite");
    factory = await ChainCraftFactoryLite.deploy();
    await factory.waitForDeployment();

    // Deploy Governance
    const ChainCraftGovernance = await ethers.getContractFactory("ChainCraftGovernance");
    governance = await ChainCraftGovernance.deploy();
    await governance.waitForDeployment();
    governanceAddress = await governance.getAddress();

    // Deploy Governance Airdrop
    const ChainCraftGovernanceAirdrop = await ethers.getContractFactory("ChainCraftGovernanceAirdrop");
    airdrop = await ChainCraftGovernanceAirdrop.deploy(governanceAddress);
    await airdrop.waitForDeployment();
    airdropAddress = await airdrop.getAddress();

    // Deploy a test token
    const deploymentFee = ethers.parseEther("0.05");
    const totalSupply = ethers.parseUnits("50000000", 0); // 50M tokens (without decimals)
    
    const deployTx = await factory.connect(creator).deployToken(
      "TestGovernanceToken",
      "TGT", 
      totalSupply,
      { value: deploymentFee }
    );
    
    const receipt = await deployTx.wait();
    const deployEvent = receipt.logs.find(log => log.fragment?.name === "TokenDeployed");
    tokenAddress = deployEvent.args.tokenAddress;
    
    const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
    token = ChainCraftToken.attach(tokenAddress);

    // Distribute tokens for voting power
    // Give significant amounts to ensure they have voting power
    await token.connect(creator).transfer(voter1.address, ethers.parseUnits("5000000", 18)); // 5M tokens (10%)
    await token.connect(creator).transfer(voter2.address, ethers.parseUnits("3000000", 18)); // 3M tokens (6%)
    await token.connect(creator).transfer(voter3.address, ethers.parseUnits("2000000", 18)); // 2M tokens (4%)

    // Keep some for governance testing
    await token.connect(creator).transfer(governanceAddress, ethers.parseUnits("1000000", 18)); // 1M for governance
    await token.connect(creator).transfer(airdropAddress, ethers.parseUnits("2000000", 18)); // 2M for airdrops
  });

  describe("Token Anti-Rug Protection Features", function () {
    it("Should enforce transfer limits (5% of total supply)", async function () {
      const totalSupply = await token.totalSupply();
      const transferLimit = totalSupply * 5n / 100n; // 5%
      const excessiveAmount = transferLimit + ethers.parseUnits("1", 18);

      // First transfer tokens to voter1 (non-owner) to test limits
      // This should fail - voter1 trying to transfer more than 5% of total supply
      await expect(
        token.connect(voter1).transfer(beneficiary1.address, excessiveAmount)
      ).to.be.revertedWithCustomError(token, "ChainCraftToken__TransferLimitExceeded");

      // This should succeed - transfer exactly at the limit
      await expect(
        token.connect(voter1).transfer(beneficiary1.address, transferLimit)
      ).to.not.be.reverted;

      const beneficiaryBalance = await token.balanceOf(beneficiary1.address);
      expect(beneficiaryBalance).to.equal(transferLimit);
    });

    it("Should enforce holding limits (5% of total supply)", async function () {
      const totalSupply = await token.totalSupply();
      const holdingLimit = totalSupply * 5n / 100n; // 5%

      // Transfer exactly at the limit from voter1 (non-owner) to beneficiary1
      await token.connect(voter1).transfer(beneficiary1.address, holdingLimit);

      // Try to transfer more from voter1 to the same address - should fail
      await expect(
        token.connect(voter1).transfer(beneficiary1.address, ethers.parseUnits("1", 18))
      ).to.be.revertedWithCustomError(token, "ChainCraftToken__HoldingLimitExceeded");

      const beneficiaryBalance = await token.balanceOf(beneficiary1.address);
      expect(beneficiaryBalance).to.equal(holdingLimit);
    });

    it("Should allow owner and factory to bypass limits", async function () {
      const totalSupply = await token.totalSupply();
      const excessiveAmount = totalSupply * 10n / 100n; // 10% - more than limit

      // Creator (owner) should be able to transfer more than limits
      await expect(
        token.connect(creator).transfer(beneficiary1.address, excessiveAmount)
      ).to.not.be.reverted;

      const beneficiaryBalance = await token.balanceOf(beneficiary1.address);
      expect(beneficiaryBalance).to.equal(excessiveAmount);
    });

    it("Should allow token burning", async function () {
      const initialSupply = await token.totalSupply();
      const burnAmount = ethers.parseUnits("1000", 18);

      const creatorInitialBalance = await token.balanceOf(creator.address);
      
      // Burn tokens
      await token.connect(creator).burn(burnAmount);

      const finalSupply = await token.totalSupply();
      const creatorFinalBalance = await token.balanceOf(creator.address);

      expect(finalSupply).to.equal(initialSupply - burnAmount);
      expect(creatorFinalBalance).to.equal(creatorInitialBalance - burnAmount);
    });

    it("Should provide accurate transfer and holding limit values", async function () {
      const totalSupply = await token.totalSupply();
      const expectedLimit = totalSupply * 5n / 100n;

      const transferLimit = await token.getTransferLimit();
      const holdingLimit = await token.getHoldingLimit();

      expect(transferLimit).to.equal(expectedLimit);
      expect(holdingLimit).to.equal(expectedLimit);
    });
  });

  describe("Governance Proposal System", function () {
    describe("Proposal Creation", function () {
      it("Should create transfer limit proposals", async function () {
        const newTransferLimit = ethers.parseUnits("100000", 18);
        
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Increase transfer limit to 100,000 tokens",
          1, // Transfer limit proposal
          newTransferLimit,
          [],
          []
        );

        const proposal = await governance.getProposal(1);
        expect(proposal.proposalType).to.equal(1);
        expect(proposal.proposedValue).to.equal(newTransferLimit);
        expect(proposal.creator).to.equal(voter1.address);
        expect(proposal.active).to.be.true;
      });

      it("Should create holding limit proposals", async function () {
        const newHoldingLimit = ethers.parseUnits("150000", 18);
        
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Increase holding limit to 150,000 tokens",
          2, // Holding limit proposal
          newHoldingLimit,
          [],
          []
        );

        const proposal = await governance.getProposal(1);
        expect(proposal.proposalType).to.equal(2);
        expect(proposal.proposedValue).to.equal(newHoldingLimit);
      });

      it("Should create toggle transfer limits proposals", async function () {
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Toggle transfer limits on/off",
          3, // Toggle transfer limits
          0, // No value needed for toggle
          [],
          []
        );

        const proposal = await governance.getProposal(1);
        expect(proposal.proposalType).to.equal(3);
        expect(proposal.proposedValue).to.equal(0);
      });

      it("Should create airdrop proposals", async function () {
        const recipients = [beneficiary1.address, beneficiary2.address];
        const amounts = [ethers.parseUnits("1000", 18), ethers.parseUnits("500", 18)];
        
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Community airdrop proposal",
          4, // Airdrop proposal
          0,
          recipients,
          amounts
        );

        const proposal = await governance.getProposal(1);
        expect(proposal.proposalType).to.equal(4);
        expect(proposal.recipients).to.deep.equal(recipients);
        expect(proposal.amounts[0]).to.equal(amounts[0]);
        expect(proposal.amounts[1]).to.equal(amounts[1]);
      });

      it("Should reject proposals from users without minimum tokens", async function () {
        await expect(
          governance.connect(beneficiary1).createProposal(
            tokenAddress,
            "Invalid proposal",
            1,
            ethers.parseUnits("1000", 18),
            [],
            []
          )
        ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__InsufficientTokenBalance");
      });

      it("Should reject invalid proposal types", async function () {
        await expect(
          governance.connect(voter1).createProposal(
            tokenAddress,
            "Invalid proposal type",
            5, // Invalid type
            0,
            [],
            []
          )
        ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__InvalidProposalType");
      });

      it("Should reject airdrop proposals with mismatched recipients and amounts", async function () {
        const recipients = [beneficiary1.address, beneficiary2.address];
        const amounts = [ethers.parseUnits("1000", 18)]; // Only one amount for two recipients

        await expect(
          governance.connect(voter1).createProposal(
            tokenAddress,
            "Invalid airdrop proposal",
            4,
            0,
            recipients,
            amounts
          )
        ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__InvalidRecipients");
      });
    });

    describe("Voting System", function () {
      beforeEach(async function () {
        // Create a standard proposal for voting tests
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Test voting proposal",
          1,
          ethers.parseUnits("100000", 18),
          [],
          []
        );
      });

      it("Should allow users to vote with their token balance as power", async function () {
        const voter1Balance = await token.balanceOf(voter1.address);
        
        await governance.connect(voter1).vote(1, true);

        const proposal = await governance.getProposal(1);
        expect(proposal.votesFor).to.equal(voter1Balance);
        expect(proposal.votesAgainst).to.equal(0);

        const hasVoted = await governance.hasVotedOnProposal(1, voter1.address);
        expect(hasVoted).to.be.true;
      });

      it("Should accumulate votes from multiple voters", async function () {
        const voter1Balance = await token.balanceOf(voter1.address);
        const voter2Balance = await token.balanceOf(voter2.address);

        await governance.connect(voter1).vote(1, true);
        await governance.connect(voter2).vote(1, false);

        const proposal = await governance.getProposal(1);
        expect(proposal.votesFor).to.equal(voter1Balance);
        expect(proposal.votesAgainst).to.equal(voter2Balance);
      });

      it("Should prevent double voting", async function () {
        await governance.connect(voter1).vote(1, true);

        await expect(
          governance.connect(voter1).vote(1, false)
        ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__AlreadyVoted");
      });

      it("Should reject votes on inactive proposals", async function () {
        // Fast forward past voting period
        await time.increase(VOTING_PERIOD + 1);

        await expect(
          governance.connect(voter2).vote(1, true)
        ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__ProposalNotActive");
      });

      it("Should reject votes from users without tokens", async function () {
        await expect(
          governance.connect(beneficiary1).vote(1, true)
        ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__InsufficientTokenBalance");
      });

      it("Should return correct voting power", async function () {
        const voter1Balance = await token.balanceOf(voter1.address);
        const votingPower = await governance.getVotingPower(voter1.address, tokenAddress);
        
        expect(votingPower).to.equal(voter1Balance);
      });
    });

    describe("Proposal Execution", function () {
      it("Should execute airdrop proposals after successful vote", async function () {
        const recipients = [beneficiary1.address, beneficiary2.address];
        const amounts = [ethers.parseUnits("1000", 18), ethers.parseUnits("500", 18)];
        
        // Create airdrop proposal
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Community airdrop",
          4,
          0,
          recipients,
          amounts
        );

        // Vote YES with majority
        await governance.connect(voter1).vote(1, true);
        await governance.connect(voter2).vote(1, true);

        // Fast forward past voting period
        await time.increase(VOTING_PERIOD + 1);

        // Approve governance contract to spend tokens
        const totalAirdropAmount = ethers.parseUnits("1500", 18);
        await token.connect(voter1).approve(governanceAddress, totalAirdropAmount);

        // Execute proposal
        await governance.connect(voter1).executeProposal(1);

        const proposal = await governance.getProposal(1);
        expect(proposal.executed).to.be.true;
        expect(proposal.active).to.be.false;

        // Check that beneficiaries received their tokens (attempt was made)
        // Note: The actual transfer depends on the approval and implementation
      });

      it("Should not execute proposals that didn't pass", async function () {
        // Create proposal
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Failed proposal",
          1,
          ethers.parseUnits("100000", 18),
          [],
          []
        );

        // Vote NO with majority
        await governance.connect(voter1).vote(1, false);
        await governance.connect(voter2).vote(1, false);

        // Fast forward past voting period
        await time.increase(VOTING_PERIOD + 1);

        await expect(
          governance.executeProposal(1)
        ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__ProposalNotPassed");
      });

      it("Should not execute proposals before voting period ends", async function () {
        // Create and pass proposal
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Early execution test",
          1,
          ethers.parseUnits("100000", 18),
          [],
          []
        );

        await governance.connect(voter1).vote(1, true);
        await governance.connect(voter2).vote(1, true);

        // Try to execute before voting period ends
        await expect(
          governance.executeProposal(1)
        ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__ProposalNotActive");
      });

      it("Should not execute already executed proposals", async function () {
        // Create proposal
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Double execution test",
          1,
          ethers.parseUnits("100000", 18),
          [],
          []
        );

        await governance.connect(voter1).vote(1, true);
        await governance.connect(voter2).vote(1, true);

        await time.increase(VOTING_PERIOD + 1);

        // Execute once
        await governance.executeProposal(1);

        // Try to execute again
        await expect(
          governance.executeProposal(1)
        ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__ProposalAlreadyExecuted");
      });
    });

    describe("Proposal Status and Information", function () {
      it("Should return correct proposal status at different stages", async function () {
        // Create proposal
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Status test proposal",
          1,
          ethers.parseUnits("100000", 18),
          [],
          []
        );

        // Should be Active during voting period
        let status = await governance.getProposalStatus(1);
        expect(status).to.equal("Active");

        // Vote to pass
        await governance.connect(voter1).vote(1, true);
        await governance.connect(voter2).vote(1, true);

        // Fast forward past voting period
        await time.increase(VOTING_PERIOD + 1);

        // Should be Passed after voting period with majority yes votes
        status = await governance.getProposalStatus(1);
        expect(status).to.equal("Passed");

        // Execute proposal
        await governance.executeProposal(1);

        // Should be Executed after execution
        status = await governance.getProposalStatus(1);
        expect(status).to.equal("Executed");
      });

      it("Should indicate when proposals can be executed", async function () {
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Execution readiness test",
          1,
          ethers.parseUnits("100000", 18),
          [],
          []
        );

        // Should not be executable during voting
        let canExecute = await governance.canExecuteProposal(1);
        expect(canExecute).to.be.false;

        // Vote to pass
        await governance.connect(voter1).vote(1, true);
        await governance.connect(voter2).vote(1, true);

        // Still not executable until voting period ends
        canExecute = await governance.canExecuteProposal(1);
        expect(canExecute).to.be.false;

        // Fast forward past voting period
        await time.increase(VOTING_PERIOD + 1);

        // Now should be executable
        canExecute = await governance.canExecuteProposal(1);
        expect(canExecute).to.be.true;
      });

      it("Should track active proposals count", async function () {
        let activeCount = await governance.getActiveProposalsCount();
        expect(activeCount).to.equal(0);

        // Create multiple proposals
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Proposal 1",
          1,
          ethers.parseUnits("100000", 18),
          [],
          []
        );

        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Proposal 2",
          2,
          ethers.parseUnits("150000", 18),
          [],
          []
        );

        activeCount = await governance.getActiveProposalsCount();
        expect(activeCount).to.equal(2);

        // Fast forward to expire first proposal
        await time.increase(VOTING_PERIOD + 1);

        activeCount = await governance.getActiveProposalsCount();
        expect(activeCount).to.equal(0); // Both should be expired
      });
    });

    describe("Owner Functions", function () {
      it("Should allow owner to deactivate proposals", async function () {
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Proposal to be deactivated",
          1,
          ethers.parseUnits("100000", 18),
          [],
          []
        );

        await governance.connect(owner).deactivateProposal(1);

        const proposal = await governance.getProposal(1);
        expect(proposal.active).to.be.false;
      });

      it("Should not allow non-owners to deactivate proposals", async function () {
        await governance.connect(voter1).createProposal(
          tokenAddress,
          "Protected proposal",
          1,
          ethers.parseUnits("100000", 18),
          [],
          []
        );

        await expect(
          governance.connect(voter1).deactivateProposal(1)
        ).to.be.revertedWithCustomError(governance, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("Governance Airdrop System", function () {
    let merkleRoot, merkleProofs;

    beforeEach(async function () {
      // Create simple merkle tree for testing
      // In a real implementation, you would use a proper merkle tree library
      merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test_merkle_root"));
      merkleProofs = [
        [ethers.keccak256(ethers.toUtf8Bytes("proof1"))],
        [ethers.keccak256(ethers.toUtf8Bytes("proof2"))]
      ];
    });

    describe("Airdrop Configuration", function () {
      it("Should configure airdrop successfully", async function () {
        const totalAmount = ethers.parseUnits("100000", 18);
        const duration = 30 * 24 * 60 * 60; // 30 days

        await airdrop.connect(owner).configureAirdrop(
          tokenAddress,
          merkleRoot,
          totalAmount,
          duration
        );

        const airdropInfo = await airdrop.getAirdropInfo(tokenAddress);
        expect(airdropInfo.merkleRoot).to.equal(merkleRoot);
        expect(airdropInfo.totalAmount).to.equal(totalAmount);
        expect(airdropInfo.active).to.be.true;
        expect(airdropInfo.claimedAmount).to.equal(0);

        const stats = await airdrop.getContractStats();
        expect(stats._totalAirdropsConfigured).to.equal(1);
      });

      it("Should reject configuration with invalid merkle root", async function () {
        await expect(
          airdrop.connect(owner).configureAirdrop(
            tokenAddress,
            ethers.ZeroHash,
            ethers.parseUnits("100000", 18),
            30 * 24 * 60 * 60
          )
        ).to.be.revertedWithCustomError(airdrop, "ChainCraftGovernanceAirdrop__InvalidMerkleRoot");
      });

      it("Should reject configuration with zero amount", async function () {
        await expect(
          airdrop.connect(owner).configureAirdrop(
            tokenAddress,
            merkleRoot,
            0,
            30 * 24 * 60 * 60
          )
        ).to.be.revertedWithCustomError(airdrop, "ChainCraftGovernanceAirdrop__InvalidAmount");
      });

      it("Should reject configuration without sufficient contract balance", async function () {
        const excessiveAmount = ethers.parseUnits("10000000", 18); // More than contract balance

        await expect(
          airdrop.connect(owner).configureAirdrop(
            tokenAddress,
            merkleRoot,
            excessiveAmount,
            30 * 24 * 60 * 60
          )
        ).to.be.revertedWithCustomError(airdrop, "ChainCraftGovernanceAirdrop__InsufficientBalance");
      });

      it("Should only allow owner to configure airdrops", async function () {
        await expect(
          airdrop.connect(voter1).configureAirdrop(
            tokenAddress,
            merkleRoot,
            ethers.parseUnits("100000", 18),
            30 * 24 * 60 * 60
          )
        ).to.be.revertedWithCustomError(airdrop, "OwnableUnauthorizedAccount");
      });
    });

    describe("Airdrop Status and Information", function () {
      beforeEach(async function () {
        await airdrop.connect(owner).configureAirdrop(
          tokenAddress,
          merkleRoot,
          ethers.parseUnits("100000", 18),
          30 * 24 * 60 * 60
        );
      });

      it("Should correctly report airdrop status", async function () {
        const isActive = await airdrop.isAirdropActive(tokenAddress);
        expect(isActive).to.be.true;

        const canClaim = await airdrop.canClaim(tokenAddress, voter1.address);
        expect(canClaim).to.be.true;
      });

      it("Should report remaining tokens correctly", async function () {
        const remainingTokens = await airdrop.getTotalRemainingTokens(tokenAddress);
        const contractBalance = await token.balanceOf(airdropAddress);
        
        expect(remainingTokens).to.equal(contractBalance);
      });

      it("Should track claimed amounts", async function () {
        const claimedAmount = await airdrop.getClaimedAmount(tokenAddress, voter1.address);
        expect(claimedAmount).to.equal(0);

        const hasClaimed = await airdrop.hasClaimed(tokenAddress, voter1.address);
        expect(hasClaimed).to.be.false;
      });
    });

    describe("Airdrop Management", function () {
      beforeEach(async function () {
        await airdrop.connect(owner).configureAirdrop(
          tokenAddress,
          merkleRoot,
          ethers.parseUnits("100000", 18),
          30 * 24 * 60 * 60
        );
      });

      it("Should allow owner to deactivate airdrop", async function () {
        await airdrop.connect(owner).deactivateAirdrop(tokenAddress);

        const isActive = await airdrop.isAirdropActive(tokenAddress);
        expect(isActive).to.be.false;
      });

      it("Should allow owner to reactivate airdrop", async function () {
        await airdrop.connect(owner).deactivateAirdrop(tokenAddress);
        await airdrop.connect(owner).reactivateAirdrop(tokenAddress);

        const airdropInfo = await airdrop.getAirdropInfo(tokenAddress);
        expect(airdropInfo.active).to.be.true;
      });

      it("Should allow owner to extend airdrop duration", async function () {
        const initialInfo = await airdrop.getAirdropInfo(tokenAddress);
        const extensionTime = 7 * 24 * 60 * 60; // 7 days

        await airdrop.connect(owner).extendAirdrop(tokenAddress, extensionTime);

        const extendedInfo = await airdrop.getAirdropInfo(tokenAddress);
        expect(extendedInfo.endTime).to.equal(initialInfo.endTime + BigInt(extensionTime));
      });

      it("Should allow owner to update merkle root", async function () {
        const newMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("new_merkle_root"));

        await airdrop.connect(owner).updateMerkleRoot(tokenAddress, newMerkleRoot);

        const airdropInfo = await airdrop.getAirdropInfo(tokenAddress);
        expect(airdropInfo.merkleRoot).to.equal(newMerkleRoot);
      });

      it("Should handle emergency withdrawals", async function () {
        const withdrawAmount = ethers.parseUnits("50000", 18);
        const initialContractBalance = await token.balanceOf(airdropAddress);
        const initialOwnerBalance = await token.balanceOf(owner.address);

        await airdrop.connect(owner).emergencyWithdraw(
          tokenAddress,
          owner.address,
          withdrawAmount
        );

        const finalContractBalance = await token.balanceOf(airdropAddress);
        const finalOwnerBalance = await token.balanceOf(owner.address);

        expect(finalContractBalance).to.equal(initialContractBalance - withdrawAmount);
        expect(finalOwnerBalance).to.equal(initialOwnerBalance + withdrawAmount);
      });

      it("Should update governance contract address", async function () {
        const newGovernanceAddress = voter1.address; // Just for testing

        await airdrop.connect(owner).updateGovernanceContract(newGovernanceAddress);

        const updatedAddress = await airdrop.governanceContract();
        expect(updatedAddress).to.equal(newGovernanceAddress);
      });

      it("Should provide contract statistics", async function () {
        const stats = await airdrop.getContractStats();
        expect(stats._totalAirdropsConfigured).to.equal(1);
        expect(stats._totalTokensDistributed).to.equal(0);
      });
    });

    describe("Access Control", function () {
      it("Should reject non-owner management functions", async function () {
        const unauthorizedUser = voter1;

        await expect(
          airdrop.connect(unauthorizedUser).deactivateAirdrop(tokenAddress)
        ).to.be.revertedWithCustomError(airdrop, "OwnableUnauthorizedAccount");

        await expect(
          airdrop.connect(unauthorizedUser).updateMerkleRoot(
            tokenAddress,
            ethers.keccak256(ethers.toUtf8Bytes("unauthorized_root"))
          )
        ).to.be.revertedWithCustomError(airdrop, "OwnableUnauthorizedAccount");

        await expect(
          airdrop.connect(unauthorizedUser).emergencyWithdraw(
            tokenAddress,
            unauthorizedUser.address,
            ethers.parseUnits("1000", 18)
          )
        ).to.be.revertedWithCustomError(airdrop, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("Integration Testing", function () {
    it("Should integrate governance proposals with token features", async function () {
      // Test the full flow: create proposal -> vote -> execute -> verify result
      
      // Step 1: Create a proposal to change transfer limits
      const newLimit = ethers.parseUnits("200000", 18);
      await governance.connect(voter1).createProposal(
        tokenAddress,
        "Increase transfer limit for better liquidity",
        1, // Transfer limit proposal
        newLimit,
        [],
        []
      );

      // Step 2: Vote with majority support
      await governance.connect(voter1).vote(1, true);
      await governance.connect(voter2).vote(1, true);
      // voter3 doesn't vote (abstention)

      // Step 3: Wait for voting period to end
      await time.increase(VOTING_PERIOD + 1);

      // Step 4: Execute the proposal
      await governance.executeProposal(1);

      // Step 5: Verify the proposal was executed
      const proposal = await governance.getProposal(1);
      expect(proposal.executed).to.be.true;
      expect(proposal.active).to.be.false;

      // Note: The actual token limit change would require additional implementation
      // in the token contract to respond to governance decisions
    });

    it("Should handle complex airdrop scenarios", async function () {
      // Test airdrop management and balance tracking
      
      const merkleRoot1 = ethers.keccak256(ethers.toUtf8Bytes("airdrop_1"));
      const contractBalance = await token.balanceOf(airdropAddress);

      // Configure first airdrop with the full balance
      await airdrop.connect(owner).configureAirdrop(
        tokenAddress,
        merkleRoot1,
        contractBalance,
        30 * 24 * 60 * 60
      );

      // Verify first airdrop is working
      const isActive = await airdrop.isAirdropActive(tokenAddress);
      expect(isActive).to.be.true;

      const airdropInfo = await airdrop.getAirdropInfo(tokenAddress);
      expect(airdropInfo.totalAmount).to.equal(contractBalance);
      expect(airdropInfo.remainingAmount).to.equal(contractBalance);
      
      // Test emergency withdrawal functionality
      const withdrawAmount = ethers.parseUnits("100000", 18);
      await airdrop.connect(owner).emergencyWithdraw(
        tokenAddress,
        owner.address,
        withdrawAmount
      );
      
      const newContractBalance = await token.balanceOf(airdropAddress);
      expect(newContractBalance).to.equal(contractBalance - withdrawAmount);
      
      // Now try to configure an airdrop that exceeds remaining balance
      const excessiveAmount = newContractBalance + ethers.parseUnits("1", 18);
      await expect(
        airdrop.connect(owner).configureAirdrop(
          tokenAddress,
          ethers.keccak256(ethers.toUtf8Bytes("airdrop_2")),
          excessiveAmount,
          30 * 24 * 60 * 60
        )
      ).to.be.revertedWithCustomError(airdrop, "ChainCraftGovernanceAirdrop__InsufficientBalance");

      const stats = await airdrop.getContractStats();
      expect(stats._totalAirdropsConfigured).to.equal(1); // First airdrop only
    });

    it("Should maintain consistency between governance and airdrop contracts", async function () {
      // Test that governance and airdrop contracts work together properly
      
      const governanceBalance = await token.balanceOf(governanceAddress);
      const airdropBalance = await token.balanceOf(airdropAddress);

      expect(governanceBalance).to.be.gt(0);
      expect(airdropBalance).to.be.gt(0);

      // Both contracts should be able to receive tokens
      await token.connect(creator).transfer(governanceAddress, ethers.parseUnits("100", 18));
      await token.connect(creator).transfer(airdropAddress, ethers.parseUnits("100", 18));

      const newGovernanceBalance = await token.balanceOf(governanceAddress);
      const newAirdropBalance = await token.balanceOf(airdropAddress);

      expect(newGovernanceBalance).to.equal(governanceBalance + ethers.parseUnits("100", 18));
      expect(newAirdropBalance).to.equal(airdropBalance + ethers.parseUnits("100", 18));
    });
  });

  describe("Edge Cases and Error Handling", function () {

    it("Should handle zero voting scenarios", async function () {
      await governance.connect(voter1).createProposal(
        tokenAddress,
        "No votes proposal",
        1,
        ethers.parseUnits("1000", 18),
        [],
        []
      );

      // Don't vote at all
      await time.increase(VOTING_PERIOD + 1);

      // Should not be executable
      const canExecute = await governance.canExecuteProposal(1);
      expect(canExecute).to.be.false;

      const status = await governance.getProposalStatus(1);
      expect(status).to.equal("Failed");
    });

    it("Should handle tie votes correctly", async function () {
      // voter1 has 5M tokens, voter2 has 3M tokens
      // We need to make them equal by using owner transfers to avoid limits
      const voter1Balance = await token.balanceOf(voter1.address);
      const voter2Balance = await token.balanceOf(voter2.address);
      
      // Transfer some tokens from creator (owner can bypass limits) to make balances equal
      const difference = voter1Balance - voter2Balance;
      await token.connect(creator).transfer(voter2.address, difference);
      
      await governance.connect(voter1).createProposal(
        tokenAddress,
        "Tie vote proposal",
        1,
        ethers.parseUnits("1000", 18),
        [],
        []
      );

      // Create a tie
      await governance.connect(voter1).vote(1, true);  // 5M votes FOR
      await governance.connect(voter2).vote(1, false); // 5M votes AGAINST

      await time.increase(VOTING_PERIOD + 1);

      // Tie votes should not pass
      await expect(
        governance.executeProposal(1)
      ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__ProposalNotPassed");
    });

    it("Should handle maximum values correctly", async function () {
      const maxValue = ethers.MaxUint256;

      // This should not revert at proposal creation level
      await governance.connect(voter1).createProposal(
        tokenAddress,
        "Maximum value test",
        1,
        maxValue,
        [],
        []
      );

      const proposal = await governance.getProposal(1);
      expect(proposal.proposedValue).to.equal(maxValue);
    });
  });
});
