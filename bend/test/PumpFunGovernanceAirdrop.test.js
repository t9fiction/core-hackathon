const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PumpFunGovernanceAirdrop", function () {
  let airdrop;
  let token;
  let governance, deployer, recipient1, recipient2, recipient3, nonOwner;
  const TOKEN_SUPPLY = ethers.parseUnits("1000000", 18);

  async function deployAirdropFixture() {
    [governance, deployer, recipient1, recipient2, recipient3, nonOwner] = await ethers.getSigners();
    
    // Deploy Airdrop contract with governance as owner
    const PumpFunGovernanceAirdrop = await ethers.getContractFactory("PumpFunGovernanceAirdrop");
    airdrop = await PumpFunGovernanceAirdrop.deploy(governance.address);
    await airdrop.waitForDeployment();
    
    // Deploy mock ERC20 token for testing
    const MockToken = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
    token = await MockToken.deploy("TestToken", "TEST", TOKEN_SUPPLY);
    await token.waitForDeployment();
    
    // Transfer tokens to airdrop contract for distribution
    await token.transfer(await airdrop.getAddress(), ethers.parseUnits("100000", 18));
    
    return { airdrop, token, governance, deployer, recipient1, recipient2, recipient3, nonOwner };
  }

  describe("Deployment", function () {
    it("Should deploy with correct owner", async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);
      
      expect(await airdrop.owner()).to.equal(governance.address);
    });

    it("Should revert deployment with zero address owner", async function () {
      const PumpFunGovernanceAirdrop = await ethers.getContractFactory("PumpFunGovernanceAirdrop");
      
      await expect(
        PumpFunGovernanceAirdrop.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(airdrop, "OwnableInvalidOwner");
    });
  });

  describe("Execute Airdrop", function () {
    it("Should execute airdrop successfully with valid parameters", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address, recipient2.address, recipient3.address];
      const amounts = [
        ethers.parseUnits("100", 18),
        ethers.parseUnits("200", 18),
        ethers.parseUnits("150", 18)
      ];
      
      // Execute airdrop
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.emit(airdrop, "AirdropClaimed")
        .withArgs(await token.getAddress(), recipient1.address, amounts[0])
        .and.to.emit(airdrop, "AirdropClaimed")
        .withArgs(await token.getAddress(), recipient2.address, amounts[1])
        .and.to.emit(airdrop, "AirdropClaimed")
        .withArgs(await token.getAddress(), recipient3.address, amounts[2]);
      
      // Check balances
      expect(await token.balanceOf(recipient1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(recipient2.address)).to.equal(amounts[1]);
      expect(await token.balanceOf(recipient3.address)).to.equal(amounts[2]);
      
      // Check claimed status
      expect(await airdrop.claimed(await token.getAddress(), recipient1.address)).to.be.true;
      expect(await airdrop.claimed(await token.getAddress(), recipient2.address)).to.be.true;
      expect(await airdrop.claimed(await token.getAddress(), recipient3.address)).to.be.true;
    });

    it("Should handle single recipient airdrop", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("500", 18)];
      
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.emit(airdrop, "AirdropClaimed")
        .withArgs(await token.getAddress(), recipient1.address, amounts[0]);
      
      expect(await token.balanceOf(recipient1.address)).to.equal(amounts[0]);
    });

    it("Should handle large batch airdrop", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      // Create arrays for 10 recipients
      const recipients = [];
      const amounts = [];
      for (let i = 0; i < 10; i++) {
        recipients.push(ethers.Wallet.createRandom().address);
        amounts.push(ethers.parseUnits("50", 18));
      }
      
      const totalAmount = amounts.reduce((sum, amount) => sum + amount, BigInt(0));
      const initialBalance = await token.balanceOf(await airdrop.getAddress());
      
      await airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts);
      
      // Check that total amount was deducted from contract
      const finalBalance = await token.balanceOf(await airdrop.getAddress());
      expect(initialBalance - finalBalance).to.equal(totalAmount);
    });

    it("Should reject airdrop from non-owner", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("100", 18)];
      
      await expect(
        airdrop.connect(nonOwner).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should reject airdrop with mismatched array lengths", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address, recipient2.address];
      const amounts = [ethers.parseUnits("100", 18)]; // Mismatched length
      
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.be.revertedWithCustomError(airdrop, "ArraysLengthMismatch")
        .withArgs(recipients.length, amounts.length);
    });

    it("Should reject airdrop with zero token address", async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("100", 18)];
      
      await expect(
        airdrop.connect(governance).executeAirdrop(ethers.ZeroAddress, recipients, amounts)
      ).to.be.revertedWithCustomError(airdrop, "ZeroAmount");
    });

    it("Should reject airdrop with zero amount", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address];
      const amounts = [0];
      
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.be.revertedWithCustomError(airdrop, "ZeroAmount");
    });

    it("Should reject airdrop with insufficient contract balance", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const contractBalance = await token.balanceOf(await airdrop.getAddress());
      const recipients = [recipient1.address];
      const amounts = [contractBalance + BigInt(1)]; // More than available
      
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.be.revertedWithCustomError(airdrop, "InsufficientBalance")
        .withArgs(contractBalance, amounts[0]);
    });

    it("Should reject airdrop to already claimed recipient", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("100", 18)];
      
      // First airdrop should succeed
      await airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts);
      
      // Second airdrop to same recipient should fail
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed")
        .withArgs(recipient1.address);
    });

    it("Should handle partial failure gracefully", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address, recipient2.address];
      const amounts = [ethers.parseUnits("100", 18), ethers.parseUnits("200", 18)];
      
      // First airdrop succeeds
      await airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts);
      
      // Second airdrop with same recipients should fail at first recipient
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed")
        .withArgs(recipient1.address);
      
      // recipient2 should not receive second airdrop due to atomic failure
      expect(await token.balanceOf(recipient2.address)).to.equal(amounts[1]);
    });
  });

  describe("Multiple Tokens Support", function () {
    let token2;

    beforeEach(async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);
      
      // Deploy second token
      const MockToken = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
      token2 = await MockToken.deploy("TestToken2", "TEST2", TOKEN_SUPPLY);
      await token2.waitForDeployment();
      
      // Transfer tokens to airdrop contract
      await token2.transfer(await airdrop.getAddress(), ethers.parseUnits("50000", 18));
    });

    it("Should handle airdrops for different tokens independently", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address];
      const amounts1 = [ethers.parseUnits("100", 18)];
      const amounts2 = [ethers.parseUnits("200", 18)];
      
      // Airdrop first token
      await airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts1);
      
      // Airdrop second token to same recipient should work
      await airdrop.connect(governance).executeAirdrop(await token2.getAddress(), recipients, amounts2);
      
      expect(await token.balanceOf(recipient1.address)).to.equal(amounts1[0]);
      expect(await token2.balanceOf(recipient1.address)).to.equal(amounts2[0]);
      
      // Check claimed status for both tokens
      expect(await airdrop.claimed(await token.getAddress(), recipient1.address)).to.be.true;
      expect(await airdrop.claimed(await token2.getAddress(), recipient1.address)).to.be.true;
    });

    it("Should prevent double claiming for same token but allow different tokens", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("100", 18)];
      
      // First airdrop for token1
      await airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts);
      
      // Second airdrop for token1 should fail
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed");
      
      // Airdrop for token2 should work
      await expect(
        airdrop.connect(governance).executeAirdrop(await token2.getAddress(), recipients, amounts)
      ).to.emit(airdrop, "AirdropClaimed");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle empty arrays", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [];
      const amounts = [];
      
      // Should not revert but do nothing
      await airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts);
      
      // No events should be emitted (no way to test this directly with hardhat-chai-matchers)
      // Contract balance should remain unchanged
      expect(await token.balanceOf(await airdrop.getAddress())).to.equal(ethers.parseUnits("100000", 18));
    });

    it("Should handle maximum values", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address];
      const maxAmount = await token.balanceOf(await airdrop.getAddress());
      const amounts = [maxAmount];
      
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.emit(airdrop, "AirdropClaimed")
        .withArgs(await token.getAddress(), recipient1.address, maxAmount);
      
      expect(await token.balanceOf(recipient1.address)).to.equal(maxAmount);
      expect(await token.balanceOf(await airdrop.getAddress())).to.equal(0);
    });

    it("Should handle minimum positive values", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address];
      const amounts = [BigInt(1)]; // Minimum positive value
      
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.emit(airdrop, "AirdropClaimed")
        .withArgs(await token.getAddress(), recipient1.address, BigInt(1));
      
      expect(await token.balanceOf(recipient1.address)).to.equal(BigInt(1));
    });

    it("Should handle same recipient multiple times in same transaction", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      const recipients = [recipient1.address, recipient1.address];
      const amounts = [ethers.parseUnits("100", 18), ethers.parseUnits("200", 18)];
      
      // Should fail because recipient1 will be marked as claimed after first iteration
      await expect(
        airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts)
      ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed")
        .withArgs(recipient1.address);
    });
  });

  describe("Gas Optimization", function () {
    it("Should efficiently handle large batches", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      // Create batch of 50 recipients
      const recipients = [];
      const amounts = [];
      for (let i = 0; i < 50; i++) {
        recipients.push(ethers.Wallet.createRandom().address);
        amounts.push(ethers.parseUnits("100", 18));
      }
      
      // This test mainly checks that the transaction doesn't run out of gas
      const tx = await airdrop.connect(governance).executeAirdrop(await token.getAddress(), recipients, amounts);
      const receipt = await tx.wait();
      
      // Gas should be reasonable (this is a rough check)
      expect(receipt.gasUsed).to.be.lt(3000000); // Less than 3M gas
    });
  });

  describe("Token Interaction Edge Cases", function () {
    it("Should handle token transfer failures gracefully", async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);
      
      // Deploy a token that will fail on transfer
      const FailingToken = await ethers.getContractFactory("contracts/mocks/FailingToken.sol:FailingToken");
      const failingToken = await FailingToken.deploy().catch(() => {
        // If we can't deploy a failing token mock, skip this test
        return null;
      });
      
      if (failingToken) {
        const recipients = [recipient1.address];
        const amounts = [ethers.parseUnits("100", 18)];
        
        // The transaction should fail when the token transfer fails
        await expect(
          airdrop.connect(governance).executeAirdrop(await failingToken.getAddress(), recipients, amounts)
        ).to.be.reverted;
      }
    });

    it("Should work with tokens that have different decimals", async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);
      
      // Deploy token with 6 decimals (like USDC)
      const MockToken6 = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
      // Note: This assumes our mock supports custom decimals, otherwise we'd need a different mock
      const token6 = await MockToken6.deploy("USDC Mock", "USDC", ethers.parseUnits("1000000", 6));
      await token6.waitForDeployment();
      
      // Transfer tokens to airdrop contract
      await token6.transfer(await airdrop.getAddress(), ethers.parseUnits("10000", 6));
      
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("100", 6)]; // 100 USDC with 6 decimals
      
      await expect(
        airdrop.connect(governance).executeAirdrop(await token6.getAddress(), recipients, amounts)
      ).to.emit(airdrop, "AirdropClaimed")
        .withArgs(await token6.getAddress(), recipient1.address, amounts[0]);
      
      expect(await token6.balanceOf(recipient1.address)).to.equal(amounts[0]);
    });
  });

  describe("State Consistency", function () {
    it("Should maintain consistent state across multiple airdrops", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      // Execute multiple airdrops
      const batch1 = {
        recipients: [recipient1.address, recipient2.address],
        amounts: [ethers.parseUnits("100", 18), ethers.parseUnits("200", 18)]
      };
      
      const batch2 = {
        recipients: [recipient3.address],
        amounts: [ethers.parseUnits("150", 18)]
      };
      
      await airdrop.connect(governance).executeAirdrop(await token.getAddress(), batch1.recipients, batch1.amounts);
      await airdrop.connect(governance).executeAirdrop(await token.getAddress(), batch2.recipients, batch2.amounts);
      
      // Verify all claimed statuses
      expect(await airdrop.claimed(await token.getAddress(), recipient1.address)).to.be.true;
      expect(await airdrop.claimed(await token.getAddress(), recipient2.address)).to.be.true;
      expect(await airdrop.claimed(await token.getAddress(), recipient3.address)).to.be.true;
      
      // Verify balances
      expect(await token.balanceOf(recipient1.address)).to.equal(batch1.amounts[0]);
      expect(await token.balanceOf(recipient2.address)).to.equal(batch1.amounts[1]);
      expect(await token.balanceOf(recipient3.address)).to.equal(batch2.amounts[0]);
    });

    it("Should handle state correctly when partial airdrops fail", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      
      // First successful airdrop
      await airdrop.connect(governance).executeAirdrop(
        await token.getAddress(),
        [recipient1.address],
        [ethers.parseUnits("100", 18)]
      );
      
      // Second airdrop that should fail
      await expect(
        airdrop.connect(governance).executeAirdrop(
          await token.getAddress(),
          [recipient1.address, recipient2.address], // recipient1 already claimed
          [ethers.parseUnits("50", 18), ethers.parseUnits("75", 18)]
        )
      ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed");
      
      // State should be consistent
      expect(await airdrop.claimed(await token.getAddress(), recipient1.address)).to.be.true;
      expect(await airdrop.claimed(await token.getAddress(), recipient2.address)).to.be.false; // Not claimed
      expect(await token.balanceOf(recipient2.address)).to.equal(0); // No tokens received
    });
  });
});
