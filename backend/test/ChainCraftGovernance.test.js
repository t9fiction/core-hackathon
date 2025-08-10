const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainCraft Governance Integration", function () {
  let factory, token, governance, airdrop;
  let owner, creator, voter1, voter2;

  beforeEach(async function () {
    [owner, creator, voter1, voter2] = await ethers.getSigners();

    // Deploy Factory
    const ChainCraftFactoryLite = await ethers.getContractFactory("ChainCraftFactoryLite");
    factory = await ChainCraftFactoryLite.deploy();

    // Deploy Governance
    const ChainCraftGovernance = await ethers.getContractFactory("ChainCraftGovernance");
    governance = await ChainCraftGovernance.deploy();

    // Deploy Governance Airdrop
    const ChainCraftGovernanceAirdrop = await ethers.getContractFactory("ChainCraftGovernanceAirdrop");
    airdrop = await ChainCraftGovernanceAirdrop.deploy(await governance.getAddress());

    // Deploy a token for governance testing
    const deploymentFee = ethers.parseEther("0.05");
    const tx = await factory.connect(creator).deployToken(
      "TestToken",
      "TEST", 
      ethers.parseUnits("50000000", 0), // 50M tokens without decimals
      { value: deploymentFee }
    );
    const receipt = await tx.wait();
    const deployEvent = receipt.logs.find(log => log.fragment?.name === "TokenDeployed");
    const tokenAddress = deployEvent.args.tokenAddress;
    
    const ChainCraftToken = await ethers.getContractFactory("ChainCraftToken");
    token = ChainCraftToken.attach(tokenAddress);

    // Distribute tokens for voting power
    await token.connect(creator).transfer(voter1.address, ethers.parseUnits("100000", 18));
    await token.connect(creator).transfer(voter2.address, ethers.parseUnits("50000", 18));
  });

  describe("Governance Contract Functionality", function () {
    it("Should create a proposal successfully", async function () {
      const description = "Test proposal for governance";
      const proposalType = 1; // Update Max Transfer
      const proposedValue = ethers.parseUnits("10000", 18);

      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        description,
        proposalType,
        proposedValue,
        [],
        []
      );

      const proposalCount = await governance.proposalCount();
      expect(proposalCount).to.equal(1n);

      const proposal = await governance.getProposal(1);
      expect(proposal.creator).to.equal(voter1.address);
      expect(proposal.description).to.equal(description);
      expect(proposal.proposalType).to.equal(proposalType);
      expect(proposal.proposedValue).to.equal(proposedValue);
    });

    it("Should allow voting on proposals", async function () {
      // Create proposal first
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Test proposal",
        1,
        ethers.parseUnits("10000", 18),
        [],
        []
      );

      // Vote on proposal
      await governance.connect(voter2).vote(1, true); // Vote YES

      const proposal = await governance.getProposal(1);
      const voter2Balance = await token.balanceOf(voter2.address);
      expect(proposal.votesFor).to.equal(voter2Balance);

      const hasVoted = await governance.hasVotedOnProposal(1, voter2.address);
      expect(hasVoted).to.be.true;
    });

    it("Should execute passed proposals after voting period", async function () {
      // Create airdrop proposal
      const recipients = [voter1.address, voter2.address];
      const amounts = [ethers.parseUnits("1000", 18), ethers.parseUnits("500", 18)];
      
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Airdrop proposal",
        4, // Airdrop type
        0n,
        recipients,
        amounts
      );

      // Vote YES with majority
      await governance.connect(voter1).vote(1, true);
      await governance.connect(voter2).vote(1, true);

      // Fast forward time past voting period
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]); // 7 days + 1 second
      await ethers.provider.send("evm_mine");

      // Approve governance contract to spend tokens for airdrop
      const totalAirdropAmount = ethers.parseUnits("1500", 18);
      await token.connect(voter1).approve(await governance.getAddress(), totalAirdropAmount);

      // Execute proposal
      await governance.connect(voter1).executeProposal(1);

      const proposal = await governance.getProposal(1);
      expect(proposal.executed).to.be.true;
    });

    it("Should provide correct proposal status", async function () {
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Test proposal",
        1,
        ethers.parseUnits("10000", 18),
        [],
        []
      );

      let status = await governance.getProposalStatus(1);
      expect(status).to.equal("Active");

      // Fast forward past voting period without votes
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      status = await governance.getProposalStatus(1);
      expect(status).to.equal("Failed");
    });

    it("Should check voting power correctly", async function () {
      const voter1Balance = await token.balanceOf(voter1.address);
      const votingPower = await governance.getVotingPower(voter1.address, await token.getAddress());
      expect(votingPower).to.equal(voter1Balance);
    });

    it("Should prevent double voting", async function () {
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Test proposal",
        1,
        ethers.parseUnits("10000", 18),
        [],
        []
      );

      await governance.connect(voter2).vote(1, true);

      await expect(governance.connect(voter2).vote(1, false))
        .to.be.revertedWithCustomError(governance, "ChainCraftGovernance__AlreadyVoted");
    });

    it("Should require minimum token balance for proposal creation", async function () {
      // Try to create proposal with account that has insufficient tokens
      const [, , , , insufficientAccount] = await ethers.getSigners();
      
      await expect(
        governance.connect(insufficientAccount).createProposal(
          await token.getAddress(),
          "Test proposal",
          1,
          ethers.parseUnits("10000", 18),
          [],
          []
        )
      ).to.be.revertedWithCustomError(governance, "ChainCraftGovernance__InsufficientTokenBalance");
    });
  });

  describe("Governance Airdrop Contract", function () {
    let merkleTree, merkleRoot;
    
    beforeEach(async function () {
      // For simplicity, we'll use a dummy merkle root
      merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      // Transfer tokens to airdrop contract
      const airdropAmount = ethers.parseUnits("10000", 18);
      await token.connect(creator).transfer(await airdrop.getAddress(), airdropAmount);
    });

    it("Should configure airdrop successfully", async function () {
      const totalAmount = ethers.parseUnits("10000", 18);
      const duration = 30 * 24 * 60 * 60; // 30 days

      await airdrop.configureAirdrop(
        await token.getAddress(),
        merkleRoot,
        totalAmount,
        duration
      );

      const airdropInfo = await airdrop.getAirdropInfo(await token.getAddress());
      expect(airdropInfo.merkleRoot).to.equal(merkleRoot);
      expect(airdropInfo.totalAmount).to.equal(totalAmount);
      expect(airdropInfo.active).to.be.true;
    });

    it("Should check airdrop status correctly", async function () {
      const totalAmount = ethers.parseUnits("10000", 18);
      const duration = 30 * 24 * 60 * 60;

      await airdrop.configureAirdrop(
        await token.getAddress(),
        merkleRoot,
        totalAmount,
        duration
      );

      const isActive = await airdrop.isAirdropActive(await token.getAddress());
      expect(isActive).to.be.true;

      const canClaim = await airdrop.canClaim(await token.getAddress(), voter1.address);
      expect(canClaim).to.be.true;
    });

    it("Should handle emergency withdraw", async function () {
      const withdrawAmount = ethers.parseUnits("5000", 18);
      const initialBalance = await token.balanceOf(await airdrop.getAddress());

      await airdrop.emergencyWithdraw(
        await token.getAddress(),
        owner.address,
        withdrawAmount
      );

      const finalBalance = await token.balanceOf(await airdrop.getAddress());
      expect(finalBalance).to.equal(initialBalance - withdrawAmount);

      const ownerBalance = await token.balanceOf(owner.address);
      expect(ownerBalance).to.equal(withdrawAmount);
    });

    it("Should track contract statistics", async function () {
      const totalAmount = ethers.parseUnits("10000", 18);
      const duration = 30 * 24 * 60 * 60;

      await airdrop.configureAirdrop(
        await token.getAddress(),
        merkleRoot,
        totalAmount,
        duration
      );

      const stats = await airdrop.getContractStats();
      expect(stats._totalAirdropsConfigured).to.equal(1n);
      expect(stats._totalTokensDistributed).to.equal(0n);
    });
  });

  describe("Integration with Frontend Requirements", function () {
    it("Should support all frontend governance functions", async function () {
      // Test functions that frontend expects to exist
      const proposalCount = await governance.proposalCount();
      expect(typeof proposalCount).to.equal("bigint");

      // Create a proposal to test getProposal function
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Integration test proposal",
        1,
        ethers.parseUnits("10000", 18),
        [],
        []
      );

      // Test getProposal returns all expected fields
      const proposal = await governance.getProposal(1);
      expect(proposal.creator).to.exist;
      expect(proposal.token).to.exist;
      expect(proposal.description).to.exist;
      expect(proposal.votesFor).to.exist;
      expect(proposal.votesAgainst).to.exist;
      expect(proposal.endTime).to.exist;
      expect(proposal.executed).to.exist;
      expect(proposal.active).to.exist;
      expect(proposal.proposalType).to.exist;
      expect(proposal.proposedValue).to.exist;
      expect(proposal.recipients).to.exist;
      expect(proposal.amounts).to.exist;

      // Test hasVotedOnProposal function
      const hasVoted = await governance.hasVotedOnProposal(1, voter1.address);
      expect(typeof hasVoted).to.equal("boolean");
    });

    it("Should support all proposal types from frontend", async function () {
      // Test all 4 proposal types that frontend expects
      const proposalTypes = [1, 2, 3, 4];
      
      for (let i = 0; i < proposalTypes.length; i++) {
        const type = proposalTypes[i];
        let recipients = [];
        let amounts = [];
        
        if (type === 4) { // Airdrop proposal needs recipients
          recipients = [voter1.address];
          amounts = [ethers.parseUnits("1000", 18)];
        }

        await governance.connect(voter1).createProposal(
          await token.getAddress(),
          `Test proposal type ${type}`,
          type,
          type < 3 ? ethers.parseUnits("10000", 18) : 0n,
          recipients,
          amounts
        );

        const proposal = await governance.getProposal(i + 1);
        expect(proposal.proposalType).to.equal(type);
      }
    });
  });
});
