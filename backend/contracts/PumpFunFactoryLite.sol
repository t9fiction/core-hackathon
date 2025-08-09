// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PumpFunToken.sol";
import "./PumpFunDEXManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract PumpFunFactoryLite is Ownable, ReentrancyGuard, IERC721Receiver {
    // Custom Errors
    error PumpFunFactoryLite__InsufficientEtherFee(uint256 sent, uint256 required);
    error PumpFunFactoryLite__InvalidParameters();
    error PumpFunFactoryLite__NoEtherToWithdraw();
    error PumpFunFactoryLite__TransferFailed();
    error PumpFunFactoryLite__InvalidFeeAmount(uint256 fee);
    error PumpFunFactoryLite__EmptyStringParameter();
    error PumpFunFactoryLite__TotalSupplyTooLow();
    error PumpFunFactoryLite__TotalSupplyTooHigh(uint256 supply, uint256 maxSupply);
    error PumpFunFactoryLite__TokenNotDeployedByFactory();
    error PumpFunFactoryLite__InvalidTokenAmount();

    // Events
    event TokenDeployed(
        string indexed name,
        string indexed symbol,
        address indexed tokenAddress,
        uint256 totalSupply,
        address creator,
        bool hasAntiRugProtection
    );
    event EtherFeeUpdated(uint256 oldFee, uint256 newFee);
    event EtherWithdrawn(address indexed owner, uint256 amount);
    event DEXPoolCreated(address indexed token, address indexed pair, uint256 tokenAmount, uint256 ethAmount);
    event DEXManagerUpdated(address indexed oldManager, address indexed newManager);

    // Structs
    struct TokenInfo {
        address tokenAddress;
        address creator;
        uint256 deploymentTime;
    }

    // State Variables
    uint256 public etherFee = 0.05 ether; // Base fee is now 0.05 ETH
    uint256 public constant MAX_FEE = 1 ether;
    uint256 public constant MIN_TOTAL_SUPPLY = 1000;

    // DEX Integration
    PumpFunDEXManager public dexManager;

    // Tiered max supply limits
    uint256 public constant STANDARD_MAX_SUPPLY = 100000000; // 100M tokens
    uint256 public constant PREMIUM_MAX_SUPPLY = 500000000; // 500M tokens
    uint256 public constant ULTIMATE_MAX_SUPPLY = 1000000000; // 1B tokens

    // Fee multipliers
    uint256 public constant STANDARD_FEE_MULTIPLIER = 1;  // 0.05 * 1 = 0.05 ETH
    uint256 public constant PREMIUM_FEE_MULTIPLIER = 5;   // 0.05 * 5 = 0.25 ETH
    uint256 public constant ULTIMATE_FEE_MULTIPLIER = 10; // 0.05 * 10 = 0.5 ETH

    // Mappings
    mapping(address => address[]) public creatorTokens;
    mapping(address => bool) public isDeployedToken;
    mapping(address => TokenInfo) public tokenInfo;
    address[] public allDeployedTokens;

    // Statistics
    uint256 public totalTokensDeployed;
    uint256 public totalFeesCollected;

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Set the DEX manager contract
     */
    function setDEXManager(address payable _dexManager) external onlyOwner {
        address oldManager = address(dexManager);
        dexManager = PumpFunDEXManager(_dexManager);
        emit DEXManagerUpdated(oldManager, _dexManager);
    }

    /**
     * @dev Deploy a new simple token - all tokens minted to creator
     */
    function deployToken(
        string memory name, 
        string memory symbol, 
        uint256 totalSupply
    )
        external
        payable
        nonReentrant
        returns (address tokenAddress)
    {
        _validateTokenParameters(name, symbol, totalSupply);
        uint256 requiredFee = _calculateRequiredFee(totalSupply);
        if (msg.value < requiredFee) revert PumpFunFactoryLite__InsufficientEtherFee(msg.value, requiredFee);
        if (msg.value > requiredFee) payable(msg.sender).transfer(msg.value - requiredFee);

        // Deploy token - all tokens minted to creator
        PumpFunToken token = new PumpFunToken(name, symbol, totalSupply, msg.sender);
        tokenAddress = address(token);

        tokenInfo[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            deploymentTime: block.timestamp
        });

        creatorTokens[msg.sender].push(tokenAddress);
        isDeployedToken[tokenAddress] = true;
        allDeployedTokens.push(tokenAddress);
        totalTokensDeployed++;
        totalFeesCollected += msg.value;

        emit TokenDeployed(name, symbol, tokenAddress, totalSupply, msg.sender, true);
        return tokenAddress;
    }

    /**
     * @dev Create DEX pool - simplified version
     */
    function createDEXPool(address tokenAddress, uint256 tokenAmount, uint24 fee) external payable nonReentrant {
        if (!isDeployedToken[tokenAddress]) revert PumpFunFactoryLite__TokenNotDeployedByFactory();
        if (address(dexManager) == address(0)) revert PumpFunFactoryLite__InvalidParameters();
        if (msg.value == 0 || tokenAmount == 0) revert PumpFunFactoryLite__InvalidTokenAmount();
        
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
        IERC20(tokenAddress).approve(address(dexManager), tokenAmount);
        dexManager.authorizeTokenFromFactory(tokenAddress);
        dexManager.createLiquidityPoolWithETH{value: msg.value}(tokenAddress, fee, tokenAmount);

        address wethToken = dexManager.WETH();
        emit DEXPoolCreated(tokenAddress, wethToken, tokenAmount, msg.value);
    }

    /**
     * @dev Validate token deployment parameters
     */
    function _validateTokenParameters(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) internal pure {
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert PumpFunFactoryLite__EmptyStringParameter();
        if (totalSupply < MIN_TOTAL_SUPPLY) revert PumpFunFactoryLite__TotalSupplyTooLow();
        if (totalSupply > ULTIMATE_MAX_SUPPLY) {
            revert PumpFunFactoryLite__TotalSupplyTooHigh(totalSupply, ULTIMATE_MAX_SUPPLY);
        }
    }

    /**
     * @dev Calculate required fee
     */
    function _calculateRequiredFee(uint256 totalSupply) internal view returns (uint256) {
        if (totalSupply <= STANDARD_MAX_SUPPLY) return etherFee * STANDARD_FEE_MULTIPLIER;
        else if (totalSupply <= PREMIUM_MAX_SUPPLY) return etherFee * PREMIUM_FEE_MULTIPLIER;
        else return etherFee * ULTIMATE_FEE_MULTIPLIER;
    }

    /**
     * @dev Get supply tier
     */
    function getSupplyTier(uint256 totalSupply)
        external
        pure
        returns (string memory tier, uint256 maxSupply, uint256 feeMultiplier)
    {
        if (totalSupply <= STANDARD_MAX_SUPPLY) {
            return ("Standard", STANDARD_MAX_SUPPLY, STANDARD_FEE_MULTIPLIER);
        } else if (totalSupply <= PREMIUM_MAX_SUPPLY) {
            return ("Premium", PREMIUM_MAX_SUPPLY, PREMIUM_FEE_MULTIPLIER);
        } else {
            return ("Ultimate", ULTIMATE_MAX_SUPPLY, ULTIMATE_FEE_MULTIPLIER);
        }
    }

    /**
     * @dev Get required fee
     */
    function getRequiredFee(uint256 totalSupply) external view returns (uint256) {
        return _calculateRequiredFee(totalSupply);
    }

    /**
     * @dev Update deployment fee
     */
    function setEtherFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_FEE) revert PumpFunFactoryLite__InvalidFeeAmount(newFee);
        uint256 oldFee = etherFee;
        etherFee = newFee;
        emit EtherFeeUpdated(oldFee, newFee);
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert PumpFunFactoryLite__NoEtherToWithdraw();
        (bool success,) = payable(owner()).call{value: balance}("");
        if (!success) revert PumpFunFactoryLite__TransferFailed();
        emit EtherWithdrawn(owner(), balance);
    }

    /**
     * @dev Get token information
     */
    function getTokenInfo(address tokenAddress)
        external
        view
        returns (address creator, uint256 deploymentTime)
    {
        TokenInfo memory info = tokenInfo[tokenAddress];
        return (info.creator, info.deploymentTime);
    }

    /**
     * @dev Get factory statistics
     */
    function getFactoryStats()
        external
        view
        returns (uint256 _totalTokensDeployed, uint256 _totalFeesCollected, uint256 _currentBalance)
    {
        return (totalTokensDeployed, totalFeesCollected, address(this).balance);
    }

    /**
     * @dev Get tokens by creator
     */
    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    /**
     * @dev Get all deployed tokens
     */
    function getAllDeployedTokens() external view returns (address[] memory) {
        return allDeployedTokens;
    }

    // Functions for backwards compatibility
    function getAirdropContract() external pure returns (address) {
        return address(0); // No airdrop contract in simplified version
    }

    // Receive ETH
    receive() external payable {}
    fallback() external payable {}
}
