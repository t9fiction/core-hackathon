const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunGovernance", function () {
  let governance;
  let token;
  let airdrop;
  let deployer, voter1, voter2, voter3, recipient1, recipient2;
  
  const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days
  const MINIMUM_VOTING_POWER = 1;
  const QUORUM_PERCENTAGE = 10;
  const TOKEN_SUPPLY = ethers.parseUnits("1000000", 18);

  async function deployGovernanceFixture() {
    [deployer, voter1, voter2, voter3, recipient1, recipient2] = await ethers.getSigners();
    
    // Deploy Governance contract
    const PumpFunGovernance = await ethers.getContractFactory("PumpFunGovernance");
    governance = await PumpFunGovernance.deploy();
    await governance.waitForDeployment();
    
    // Deploy Airdrop contract
    const PumpFunGovernanceAirdrop = await ethers.getContractFactory("PumpFunGovernanceAirdrop");
    airdrop = await PumpFunGovernanceAirdrop.deploy(await governance.getAddress());
    await airdrop.waitForDeployment();
    
    // Set airdrop contract in governance
    await governance.setAirdropContract(await airdrop.getAddress());
    
    // Deploy mock ERC20 token for testing
    const MockToken = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
    token = await MockToken.deploy("TestToken", "TEST", TOKEN_SUPPLY);
    await token.waitForDeployment();
    
    // Distribute tokens for voting
    await token.transfer(voter1.address, ethers.parseUnits("100000", 18)); // 10%
    await token.transfer(voter2.address, ethers.parseUnits("150000", 18)); // 15%
    await token.transfer(voter3.address, ethers.parseUnits("50000", 18));  // 5%
    
    return { governance, token, airdrop, deployer, voter1, voter2, voter3, recipient1, recipient2 };
  }

  describe("Deployment", function () {
    it("Should deploy with correct initial parameters", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      expect(await governance.owner()).to.equal(deployer.address);
      expect(await governance.governanceEnabled()).to.be.true;
      expect(await governance.proposalCount()).to.equal(0);
      expect(await governance.VOTING_PERIOD()).to.equal(VOTING_PERIOD);
      expect(await governance.MINIMUM_VOTING_POWER()).to.equal(MINIMUM_VOTING_POWER);
      expect(await governance.QUORUM_PERCENTAGE()).to.equal(QUORUM_PERCENTAGE);
    });

    it("Should set airdrop contract correctly", async function () {
      const { governance, airdrop } = await loadFixture(deployGovernanceFixture);
      
      expect(await governance.airdropContract()).to.equal(await airdrop.getAddress());
    });
  });

  describe("Proposal Creation", function () {
    it("Should allow creating a proposal with sufficient voting power", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      const description = "Increase max transfer amount";
      const proposalType = 1; // Max transfer amount
      const proposedValue = ethers.parseUnits("5000", 18);
      
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          description,
          proposalType,
          proposedValue,
          [],
          []
        )
      ).to.emit(governance, "ProposalCreated")
        .withArgs(0, voter1.address, await token.getAddress(), description);
      
      expect(await governance.proposalCount()).to.equal(1);
    });

    it("Should create airdrop proposal with recipients and amounts", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      const description = "Community airdrop";
      const proposalType = 4; // Airdrop
      const recipients = [recipient1.address, recipient2.address];
      const amounts = [ethers.parseUnits("100", 18), ethers.parseUnits("200", 18)];
      
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          description,
          proposalType,
          0,
          recipients,
          amounts
        )
      ).to.emit(governance, "ProposalCreated");
      
      const proposal = await governance.getProposal(0);
      expect(proposal.recipients).to.deep.equal(recipients);
      expect(proposal.amounts).to.deep.equal(amounts);
    });

    it("Should reject proposal creation when governance is disabled", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      await governance.setGovernanceEnabled(false);
      
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          "Test proposal",
          1,
          1000,
          [],
          []
        )
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__GovernanceDisabled");
    });

    it("Should reject proposal with insufficient voting power", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      // voter3 has 5% which should be sufficient, but let's test with someone who has 0%
      await expect(
        governance.connect(deployer).createProposal(
          await token.getAddress(),
          "Test proposal",
          1,
          1000,
          [],
          []
        )
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__InvalidVotingPower");
    });

    it("Should reject invalid proposal types", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          "Invalid proposal",
          5, // Invalid type (> 4)
          1000,
          [],
          []
        )
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__InvalidProposalType");
    });

    it("Should reject airdrop proposal with mismatched arrays", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      const recipients = [recipient1.address, recipient2.address];
      const amounts = [ethers.parseUnits("100", 18)]; // Mismatched length
      
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          "Invalid airdrop",
          4,
          0,
          recipients,
          amounts
        )
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__InvalidAirdropArrays");
    });

    it("Should reject airdrop proposal without airdrop contract", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      // Clear airdrop contract
      await governance.setAirdropContract(ethers.ZeroAddress).catch(() => {}); // Should fail
      
      // Deploy new governance without airdrop contract
      const PumpFunGovernance = await ethers.getContractFactory("PumpFunGovernance");
      const newGovernance = await PumpFunGovernance.deploy();
      await newGovernance.waitForDeployment();
      
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("100", 18)];
      
      // Transfer tokens to voter1 for new governance testing
      await token.transfer(voter1.address, ethers.parseUnits("10000", 18));
      
      await expect(
        newGovernance.connect(voter1).createProposal(
          await token.getAddress(),
          "Airdrop without contract",
          4,
          0,
          recipients,
          amounts
        )
      ).to.be.revertedWithCustomError(newGovernance, "PumpFunGovernance__InvalidAirdropContract");
    });
  });

  describe("Voting", function () {
    let proposalId;

    beforeEach(async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      // Create a proposal
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Test proposal",
        1,
        ethers.parseUnits("5000", 18),
        [],
        []
      );
      proposalId = 0;
    });

    it("Should allow voting with valid voting power", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      const voter1Power = await token.balanceOf(voter1.address);
      
      await expect(governance.connect(voter1).vote(proposalId, true))
        .to.emit(governance, "VoteCast")
        .withArgs(proposalId, voter1.address, true, voter1Power);
      
      expect(await governance.hasVotedOnProposal(proposalId, voter1.address)).to.be.true;
    });

    it("Should accumulate votes correctly", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await governance.connect(voter1).vote(proposalId, true);
      await governance.connect(voter2).vote(proposalId, true);
      await governance.connect(voter3).vote(proposalId, false);
      
      const proposal = await governance.getProposal(proposalId);
      const voter1Power = await token.balanceOf(voter1.address);
      const voter2Power = await token.balanceOf(voter2.address);
      const voter3Power = await token.balanceOf(voter3.address);
      
      expect(proposal.votesFor).to.equal(voter1Power + voter2Power);
      expect(proposal.votesAgainst).to.equal(voter3Power);
    });

    it("Should prevent double voting", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await governance.connect(voter1).vote(proposalId, true);
      
      await expect(
        governance.connect(voter1).vote(proposalId, false)
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__AlreadyVoted");
    });

    it("Should reject voting on inactive proposal", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      // Create a proposal and then try to vote on non-existent one
      await expect(
        governance.connect(voter1).vote(999, true)
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__ProposalNotActive");
    });

    it("Should reject voting after deadline", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      // Fast forward past voting period
      await time.increase(VOTING_PERIOD + 1);
      
      await expect(
        governance.connect(voter1).vote(proposalId, true)
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__VotingPeriodEnded");
    });

    it("Should reject voting with no voting power", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      // deployer has no tokens
      await expect(
        governance.connect(deployer).vote(proposalId, true)
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__NoVotingPower");
    });
  });

  describe("Proposal Execution", function () {
    let proposalId;

    beforeEach(async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      // Create a proposal
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Test proposal",
        1, // Max transfer amount
        ethers.parseUnits("5000", 18),
        [],
        []
      );
      proposalId = 0;
      
      // Vote to reach quorum
      await governance.connect(voter1).vote(proposalId, true); // 10%
      await governance.connect(voter2).vote(proposalId, true); // 15% - total 25% > 10% quorum
    });

    it("Should execute proposal after voting period with sufficient support", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      // Fast forward past voting period
      await time.increase(VOTING_PERIOD + 1);
      
      await expect(governance.connect(voter1).executeProposal(proposalId))
        .to.emit(governance, "ProposalExecuted")
        .withArgs(proposalId, voter1.address);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
      expect(proposal.active).to.be.false;
    });

    it("Should reject execution before voting period ends", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await expect(
        governance.connect(voter1).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__VotingPeriodNotEnded");
    });

    it("Should reject execution without sufficient quorum", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      // Create new proposal with insufficient votes
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Low support proposal",
        1,
        1000,
        [],
        []
      );
      const lowSupportProposalId = 1;
      
      // Only voter3 votes (5% < 10% quorum)
      await governance.connect(voter3).vote(lowSupportProposalId, true);
      
      await time.increase(VOTING_PERIOD + 1);
      
      await expect(
        governance.connect(voter1).executeProposal(lowSupportProposalId)
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__QuorumNotReached");
    });

    it("Should reject execution of already executed proposal", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await time.increase(VOTING_PERIOD + 1);
      await governance.connect(voter1).executeProposal(proposalId);
      
      await expect(
        governance.connect(voter1).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__ProposalAlreadyExecuted");
    });

    it("Should reject execution of inactive proposal", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await time.increase(VOTING_PERIOD + 1);
      
      await expect(
        governance.connect(voter1).executeProposal(999)
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__ProposalNotActive");
    });
  });

  describe("Proposal Types", function () {
    async function createAndExecuteProposal(governance, token, proposalType, proposedValue, recipients = [], amounts = []) {
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        `Proposal type ${proposalType}`,
        proposalType,
        proposedValue,
        recipients,
        amounts
      );
      
      const proposalId = (await governance.proposalCount()) - BigInt(1);
      
      // Vote and execute
      await governance.connect(voter1).vote(proposalId, true);
      await governance.connect(voter2).vote(proposalId, true);
      await time.increase(VOTING_PERIOD + 1);
      await governance.connect(voter1).executeProposal(proposalId);
      
      return proposalId;
    }

    it("Should handle max transfer amount proposal (type 1)", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      const newAmount = ethers.parseUnits("10000", 18);
      
      // Note: This test assumes we have a mock token that implements the interface
      // In practice, you'd need to deploy a proper PumpFunToken for this test
      await createAndExecuteProposal(governance, token, 1, newAmount);
    });

    it("Should handle max holding proposal (type 2)", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      const newAmount = ethers.parseUnits("20000", 18);
      
      await createAndExecuteProposal(governance, token, 2, newAmount);
    });

    it("Should handle transfer limits enabled proposal (type 3)", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      await createAndExecuteProposal(governance, token, 3, 0); // Disable (false = 0)
      await createAndExecuteProposal(governance, token, 3, 1); // Enable (true = 1)
    });

    it("Should handle airdrop proposal (type 4)", async function () {
      const { governance, token, airdrop } = await loadFixture(deployGovernanceFixture);
      const recipients = [recipient1.address, recipient2.address];
      const amounts = [ethers.parseUnits("100", 18), ethers.parseUnits("200", 18)];
      
      // Fund the token contract for the airdrop
      // Note: This assumes the token has sufficient balance for the airdrop
      
      await createAndExecuteProposal(governance, token, 4, 0, recipients, amounts);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set airdrop contract", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      const newAirdrop = recipient1.address;
      
      await expect(governance.setAirdropContract(newAirdrop))
        .to.emit(governance, "AirdropContractUpdated")
        .withArgs(await airdrop.getAddress(), newAirdrop);
      
      expect(await governance.airdropContract()).to.equal(newAirdrop);
    });

    it("Should reject setting zero address as airdrop contract", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await expect(
        governance.setAirdropContract(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(governance, "PumpFunGovernance__InvalidAirdropContract");
    });

    it("Should allow owner to enable/disable governance", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await expect(governance.setGovernanceEnabled(false))
        .to.emit(governance, "GovernanceEnabled")
        .withArgs(false);
      
      expect(await governance.governanceEnabled()).to.be.false;
      
      await expect(governance.setGovernanceEnabled(true))
        .to.emit(governance, "GovernanceEnabled")
        .withArgs(true);
      
      expect(await governance.governanceEnabled()).to.be.true;
    });

    it("Should prevent non-owner from calling admin functions", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await expect(
        governance.connect(voter1).setAirdropContract(recipient1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        governance.connect(voter1).setGovernanceEnabled(false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("View Functions", function () {
    it("Should return correct proposal information", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      const description = "Test proposal";
      const proposalType = 1;
      const proposedValue = ethers.parseUnits("5000", 18);
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("100", 18)];
      
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        description,
        proposalType,
        proposedValue,
        recipients,
        amounts
      );
      
      const proposal = await governance.getProposal(0);
      expect(proposal.creator).to.equal(voter1.address);
      expect(proposal.token).to.equal(await token.getAddress());
      expect(proposal.description).to.equal(description);
      expect(proposal.proposalType).to.equal(proposalType);
      expect(proposal.proposedValue).to.equal(proposedValue);
      expect(proposal.recipients).to.deep.equal(recipients);
      expect(proposal.amounts).to.deep.equal(amounts);
      expect(proposal.active).to.be.true;
      expect(proposal.executed).to.be.false;
    });

    it("Should return correct voting status", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Test",
        1,
        1000,
        [],
        []
      );
      
      expect(await governance.hasVotedOnProposal(0, voter1.address)).to.be.false;
      
      await governance.connect(voter1).vote(0, true);
      
      expect(await governance.hasVotedOnProposal(0, voter1.address)).to.be.true;
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle proposal with zero proposed value", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          "Zero value proposal",
          1,
          0,
          [],
          []
        )
      ).to.emit(governance, "ProposalCreated");
    });

    it("Should handle empty description", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      await expect(
        governance.connect(voter1).createProposal(
          await token.getAddress(),
          "",
          1,
          1000,
          [],
          []
        )
      ).to.emit(governance, "ProposalCreated");
    });

    it("Should handle voting power changes after proposal creation", async function () {
      const { governance, token } = await loadFixture(deployGovernanceFixture);
      
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Test proposal",
        1,
        1000,
        [],
        []
      );
      
      const initialBalance = await token.balanceOf(voter1.address);
      
      // Transfer some tokens away
      await token.connect(voter1).transfer(recipient1.address, ethers.parseUnits("50000", 18));
      
      // Voting power should be based on current balance
      const currentBalance = await token.balanceOf(voter1.address);
      expect(currentBalance).to.be.lt(initialBalance);
      
      await expect(governance.connect(voter1).vote(0, true))
        .to.emit(governance, "VoteCast")
        .withArgs(0, voter1.address, true, currentBalance);
    });

    it("Should handle multiple proposals with different tokens", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      // Deploy second token
      const MockToken = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
      const token2 = await MockToken.deploy("Token2", "TK2", TOKEN_SUPPLY);
      await token2.waitForDeployment();
      
      // Transfer tokens to voter1
      await token2.transfer(voter1.address, ethers.parseUnits("100000", 18));
      
      // Create proposals for both tokens
      await governance.connect(voter1).createProposal(
        await token.getAddress(),
        "Proposal for token1",
        1,
        1000,
        [],
        []
      );
      
      await governance.connect(voter1).createProposal(
        await token2.getAddress(),
        "Proposal for token2",
        1,
        2000,
        [],
        []
      );
      
      expect(await governance.proposalCount()).to.equal(2);
      
      const proposal1 = await governance.getProposal(0);
      const proposal2 = await governance.getProposal(1);
      
      expect(proposal1.token).to.equal(await token.getAddress());
      expect(proposal2.token).to.equal(await token2.getAddress());
    });
  });
});
