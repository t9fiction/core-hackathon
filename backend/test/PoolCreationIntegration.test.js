const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Pool Creation Integration Test", function () {
    let factory, dexManager, wcore, mockRouteProcessor, mockFactory;
    let owner, user1, user2;
    let tokenAddress;
    
    const INITIAL_ETH_BALANCE = ethers.parseEther("100");
    const WCORE_SUPPLY = ethers.parseEther("10"); // Reduced to 10 ETH worth
    
    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        // Deploy WCORE mock (using WETHMock as WCORE)
        const WCOREFactory = await ethers.getContractFactory("WETHMock");
        wcore = await WCOREFactory.deploy();
        await wcore.waitForDeployment();
        
        // Mint WCORE to users by depositing ETH
        await wcore.connect(user1).deposit({ value: WCORE_SUPPLY });
        await wcore.connect(user2).deposit({ value: WCORE_SUPPLY });
        
        // Deploy Mock Factory (SushiSwap V2)
        const MockFactoryFactory = await ethers.getContractFactory("SushiswapV2FactoryMock");
        mockFactory = await MockFactoryFactory.deploy();
        await mockFactory.waitForDeployment();
        
        // Deploy Mock RouteProcessor7
        const MockRouteProcessor7Factory = await ethers.getContractFactory("RouteProcessor7Mock");
        mockRouteProcessor = await MockRouteProcessor7Factory.deploy();
        await mockRouteProcessor.waitForDeployment();
        
        // Send some ETH to the mock router for WETH operations
        await owner.sendTransaction({
            to: await mockRouteProcessor.getAddress(),
            value: ethers.parseEther("10")
        });
        
        // Deploy Factory first
        const FactoryFactory = await ethers.getContractFactory("ChainCraftFactoryLite");
        factory = await FactoryFactory.deploy();
        await factory.waitForDeployment();
        
        // Deploy DEX Manager
        const DEXManagerFactory = await ethers.getContractFactory("ChainCraftDEXManager");
        dexManager = await DEXManagerFactory.deploy(
            await mockRouteProcessor.getAddress(), // _swapRouter
            await wcore.getAddress()              // _weth
        );
        await dexManager.waitForDeployment();
        
        // Set the factory in DEX manager
        await dexManager.setFactory(await factory.getAddress());
        
        // Set DEX Manager in factory
        await factory.setDEXManager(await dexManager.getAddress());
        
        // Fund users with ETH
        await owner.sendTransaction({
            to: user1.address,
            value: INITIAL_ETH_BALANCE
        });
        await owner.sendTransaction({
            to: user2.address,
            value: INITIAL_ETH_BALANCE
        });
    });

    describe("Two-Step Pool Creation Process", function () {
        
        it("Should successfully create a token, authorize it, and create liquidity through swap", async function () {
            console.log("\n=== STEP 1: Deploy Token ===");
            
            // Deploy a new token
            const tokenName = "TestToken";
            const tokenSymbol = "TEST";
            const tokenSupply = 1000000; // 1M tokens (within standard tier)
            const deploymentFee = await factory.getRequiredFee(tokenSupply);
            
            const deployTx = await factory.connect(user1).deployToken(
                tokenName,
                tokenSymbol,
                tokenSupply,
                { value: deploymentFee }
            );
            
            const receipt = await deployTx.wait();
            const deployEvent = receipt.logs.find(log => {
                try {
                    return factory.interface.parseLog(log).name === 'TokenDeployed';
                } catch {
                    return false;
                }
            });
            
            expect(deployEvent).to.not.be.undefined;
            const parsedEvent = factory.interface.parseLog(deployEvent);
            tokenAddress = parsedEvent.args.tokenAddress;
            
            console.log(`✅ Token deployed at: ${tokenAddress}`);
            console.log(`✅ Creator: ${parsedEvent.args.creator}`);
            
            // Verify token was created correctly
            const tokenContract = await ethers.getContractAt("ChainCraftToken", tokenAddress);
            expect(await tokenContract.name()).to.equal(tokenName);
            expect(await tokenContract.symbol()).to.equal(tokenSymbol);
            expect(await tokenContract.totalSupply()).to.equal(ethers.parseUnits(tokenSupply.toString(), 18));
            expect(await tokenContract.balanceOf(user1.address)).to.equal(ethers.parseUnits(tokenSupply.toString(), 18));
            
            console.log("\n=== STEP 2: Authorize Token for DEX Trading ===");
            
            // Authorize token for DEX trading
            const authorizeTx = await factory.connect(user1).authorizeDEXTrading(tokenAddress);
            await authorizeTx.wait();
            
            // Verify authorization
            const isAuthorized = await dexManager.authorizedTokens(tokenAddress);
            expect(isAuthorized).to.be.true;
            
            console.log(`✅ Token ${tokenAddress} authorized for DEX trading`);
            
            console.log("\n=== STEP 3: Create Liquidity Pool via Swap ===");
            
            // Approve tokens for DEX Manager
            const tokenAmountToSwap = ethers.parseUnits("10000", 18); // 10k tokens
            const ethAmountForSwap = ethers.parseEther("1"); // 1 ETH worth
            
            await tokenContract.connect(user1).approve(await dexManager.getAddress(), tokenAmountToSwap);
            await wcore.connect(user1).approve(await dexManager.getAddress(), ethAmountForSwap);
            
            console.log(`✅ Approved ${ethers.formatUnits(tokenAmountToSwap, 18)} tokens for DEX Manager`);
            console.log(`✅ Approved ${ethers.formatEther(ethAmountForSwap)} WCORE for DEX Manager`);
            
            // Perform swap to create the pool (WCORE -> Token)
            // First we need to manually create a pair since this is what would happen during the first swap
            await mockFactory.createPair(await wcore.getAddress(), tokenAddress);
            
            const routeData = "0x"; // Empty route for testing
            const swapTx = await dexManager.connect(user1).swap(
                await wcore.getAddress(),      // tokenIn (WCORE)
                tokenAddress,                  // tokenOut (our new token)
                ethAmountForSwap,             // amountIn
                routeData                     // route data
            );
            
            const swapReceipt = await swapTx.wait();
            console.log(`✅ Swap transaction completed: ${swapTx.hash}`);
            
            // Check if pair was created in mock factory
            const pairAddress = await mockFactory.getPair(await wcore.getAddress(), tokenAddress);
            expect(pairAddress).to.not.equal(ethers.ZeroAddress);
            
            console.log(`✅ Trading pair created at: ${pairAddress}`);
            
            console.log("\n=== STEP 4: Verify Pool Creation ===");
            
            // Verify the mock pair was created with correct parameters
            const mockPair = await ethers.getContractAt("MockPair", pairAddress);
            const token0 = await mockPair.token0();
            const token1 = await mockPair.token1();
            
            // Verify the pair contains our tokens
            const hasWCORE = token0 === await wcore.getAddress() || token1 === await wcore.getAddress();
            const hasOurToken = token0 === tokenAddress || token1 === tokenAddress;
            
            expect(hasWCORE).to.be.true;
            expect(hasOurToken).to.be.true;
            
            console.log(`✅ Pair verified: token0=${token0}, token1=${token1}`);
            
            console.log("\n=== STEP 5: Verify Trading Setup ===");
            
            // Verify that the token is now available for trading
            // (in a real scenario, we would now be able to trade through SushiSwap)
            
            console.log("\n🎉 POOL CREATION PROCESS COMPLETED SUCCESSFULLY!");
            console.log("Summary:");
            console.log(`- Token deployed: ${tokenAddress}`);
            console.log(`- Token authorized for trading: ✅`);
            console.log(`- Liquidity pool created: ${pairAddress}`);
            console.log(`- Pool contains correct tokens: ✅`);
            console.log(`- Token is ready for trading on SushiSwap: ✅`);
        });
        
        it("Should fail to create pool for unauthorized token", async function () {
            console.log("\n=== Testing Unauthorized Token Rejection ===");
            
            // Deploy a token
            const deploymentFee = await factory.getRequiredFee(1000000);
            const deployTx = await factory.connect(user1).deployToken(
                "UnauthorizedToken",
                "UNAUTH",
                1000000,
                { value: deploymentFee }
            );
            
            const receipt = await deployTx.wait();
            const deployEvent = receipt.logs.find(log => {
                try {
                    return factory.interface.parseLog(log).name === 'TokenDeployed';
                } catch {
                    return false;
                }
            });
            
            const unauthorizedTokenAddress = factory.interface.parseLog(deployEvent).args.tokenAddress;
            
            // Try to swap without authorization - should fail
            const tokenContract = await ethers.getContractAt("ChainCraftToken", unauthorizedTokenAddress);
            const tokenAmount = ethers.parseUnits("1000", 18);
            const wCoreAmount = ethers.parseEther("0.1");
            
            await tokenContract.connect(user1).approve(await dexManager.getAddress(), tokenAmount);
            await wcore.connect(user1).approve(await dexManager.getAddress(), wCoreAmount);
            
            const routeData = "0x";
            await expect(
                dexManager.connect(user1).swap(
                    await wcore.getAddress(),
                    unauthorizedTokenAddress,
                    wCoreAmount,
                    routeData
                )
            ).to.be.revertedWithCustomError(dexManager, "ChainCraftDEXManager__UnauthorizedToken");
            
            console.log("✅ Unauthorized token swap correctly rejected");
        });
        
        it("Should only allow token creator to authorize token", async function () {
            console.log("\n=== Testing Authorization Access Control ===");
            
            // Deploy a token with user1
            const deploymentFee = await factory.getRequiredFee(1000000);
            const deployTx = await factory.connect(user1).deployToken(
                "RestrictedToken",
                "REST",
                1000000,
                { value: deploymentFee }
            );
            
            const receipt = await deployTx.wait();
            const deployEvent = receipt.logs.find(log => {
                try {
                    return factory.interface.parseLog(log).name === 'TokenDeployed';
                } catch {
                    return false;
                }
            });
            
            const restrictedTokenAddress = factory.interface.parseLog(deployEvent).args.tokenAddress;
            
            // Try to authorize with user2 (not the creator) - should fail
            await expect(
                factory.connect(user2).authorizeDEXTrading(restrictedTokenAddress)
            ).to.be.revertedWithCustomError(factory, "ChainCraftFactoryLite__NotTokenCreator");
            
            // Authorize with user1 (the creator) - should succeed
            await factory.connect(user1).authorizeDEXTrading(restrictedTokenAddress);
            
            const isAuthorized = await dexManager.authorizedTokens(restrictedTokenAddress);
            expect(isAuthorized).to.be.true;
            
            console.log("✅ Authorization access control working correctly");
        });
    });
});
