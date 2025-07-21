// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPumpFunFactoryLite {
    function getAirdropContract() external view returns (address);
}

contract PumpFunToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable, ReentrancyGuard {
    // Custom Errors
    error PumpFunToken__ZeroAddress();
    error PumpFunToken__ZeroAmount();
    error PumpFunToken__InsufficientBalance(uint256 available, uint256 requested);
    error PumpFunToken__TransferLocked(address holder, uint256 amount, uint256 unlockTime);
    error PumpFunToken__ExceedsMaxTransferAmount(uint256 amount, uint256 maxAmount);
    error PumpFunToken__ExceedsMaxHolding(uint256 amount, uint256 maxHolding);
    error PumpFunToken__InvalidLockDuration(uint256 duration);
    error PumpFunToken__TokensAlreadyLocked(address holder);
    error PumpFunToken__NoLockedTokens(address holder);
    error PumpFunToken__LockNotExpired(uint256 unlockTime);
    error PumpFunToken__InvalidMintAmount(uint256 amount);
    error PumpFunToken__MintingPaused();
    error PumpFunToken__BurningPaused();
    error PumpFunToken__InvalidName();
    error PumpFunToken__InvalidSymbol();
    error PumpFunToken__OnlyFactory();
    error PumpFunToken__OnlyGovernance();
    error PumpFunToken__InvalidAirdropArrays();
    error PumpFunToken__InvalidAirdropContract();

    // Events
    event TokensLocked(address indexed holder, uint256 amount, uint256 unlockTime);
    event TokensUnlocked(address indexed holder, uint256 amount);
    event MaxTransferAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event MaxHoldingUpdated(uint256 oldAmount, uint256 newAmount);
    event LiquidityLocked(address indexed lpToken, uint256 amount, uint256 unlockTime);
    event StabilityMint(uint256 amount, uint256 price);
    event StabilityBurn(uint256 amount, uint256 price);
    event GovernanceContractUpdated(
        address indexed token, address indexed oldGovernance, address indexed newGovernance
    );
    event AirdropTriggered(address indexed airdropContract, uint256 totalAmount);
    event ContractApprovedSpender(address indexed spender, uint256 amount);

    // Modifiers
    modifier onlyFactory() {
        if (msg.sender != factory) revert PumpFunToken__OnlyFactory();
        _;
    }

    // Supply Locking Structure
    struct LockInfo {
        uint256 amount;
        uint256 unlockTime;
        bool isLocked;
    }

    // State Variables
    mapping(address => LockInfo) public lockedTokens;
    mapping(address => uint256) public lastTransferTime;
    mapping(address => bool) public isWhitelisted;

    uint256 public constant MIN_LOCK_DURATION = 1 days;
    uint256 public constant MAX_LOCK_DURATION = 365 days;
    uint256 public constant TRANSFER_COOLDOWN = 1 hours;

    uint256 public immutable MAX_SUPPLY;

    uint256 public liquidityPoolBalance; // Tracks 20% for liquidity
    uint256 public dexPoolBalance; // Tracks 40% for DEX pools
    uint256 public maxTransferAmount;
    uint256 public maxHolding;
    uint256 public stabilityThreshold = 1000000 * 10 ** 18;
    uint256 public targetPrice = 1 * 10 ** 18;

    bool public transferLimitsEnabled = true;
    bool public mintingEnabled = true;
    bool public burningEnabled = true;

    mapping(address => LockInfo) public liquidityLocks;

    address public governanceContract;
    address public immutable airdropContract;
    address public immutable factory;

    constructor(string memory name, string memory symbol, uint256 _initialSupply, address _creator, address _factory)
        ERC20(name, symbol)
        Ownable(_creator)
    {
        if (bytes(name).length == 0) revert PumpFunToken__InvalidName();
        if (bytes(symbol).length == 0) revert PumpFunToken__InvalidSymbol();
        if (_initialSupply == 0) revert PumpFunToken__ZeroAmount();
        if (_creator == address(0) || _factory == address(0)) revert PumpFunToken__ZeroAddress();

        factory = _factory;
        airdropContract = IPumpFunFactoryLite(_factory).getAirdropContract();
        if (airdropContract == address(0)) revert PumpFunToken__InvalidAirdropContract();

        MAX_SUPPLY = _initialSupply * 10 ** decimals();

        uint256 initialSupply = _initialSupply * 10 ** decimals();
        uint256 creatorAmount = (initialSupply * 10) / 100; // 10% for creator
        uint256 liquidityAmount = (initialSupply * 20) / 100; // 20% for liquidity
        uint256 dexAmount = (initialSupply * 40) / 100; // 40% for DEX pools
        uint256 communityAmount = initialSupply - creatorAmount - liquidityAmount - dexAmount; // 30% for community

        _mint(_creator, creatorAmount);
        _mint(address(this), liquidityAmount + dexAmount + communityAmount);

        // Approve factory to spend liquidity and DEX amounts
        _approve(address(this), _factory, liquidityAmount + dexAmount);
        emit ContractApprovedSpender(_factory, liquidityAmount + dexAmount);

        maxTransferAmount = (initialSupply * 1) / 100;
        maxHolding = (initialSupply * 5) / 100;

        isWhitelisted[address(this)] = true;
        isWhitelisted[_factory] = true;
        isWhitelisted[airdropContract] = true;

        // Track allocations for clarity (optional, for transparency)
        liquidityPoolBalance = liquidityAmount;
        dexPoolBalance = dexAmount;
    }

    function approveContractSpender(address spender, uint256 amount) external onlyOwner {
        if (spender == address(0)) revert PumpFunToken__ZeroAddress();
        if (amount == 0) revert PumpFunToken__ZeroAmount();
        if (balanceOf(address(this)) < amount) {
            revert PumpFunToken__InsufficientBalance(balanceOf(address(this)), amount);
        }
        _approve(address(this), spender, amount);
        emit ContractApprovedSpender(spender, amount);
    }

    function lockTokens(uint256 amount, uint256 duration) external {
        if (amount == 0) revert PumpFunToken__ZeroAmount();
        if (duration < MIN_LOCK_DURATION || duration > MAX_LOCK_DURATION) {
            revert PumpFunToken__InvalidLockDuration(duration);
        }
        if (lockedTokens[msg.sender].isLocked) revert PumpFunToken__TokensAlreadyLocked(msg.sender);
        if (balanceOf(msg.sender) < amount) revert PumpFunToken__InsufficientBalance(balanceOf(msg.sender), amount);

        uint256 unlockTime = block.timestamp + duration;
        lockedTokens[msg.sender] = LockInfo({amount: amount, unlockTime: unlockTime, isLocked: true});

        emit TokensLocked(msg.sender, amount, unlockTime);
    }

    function unlockTokens() external {
        LockInfo storage lockInfo = lockedTokens[msg.sender];
        if (!lockInfo.isLocked) revert PumpFunToken__NoLockedTokens(msg.sender);
        if (block.timestamp < lockInfo.unlockTime) revert PumpFunToken__LockNotExpired(lockInfo.unlockTime);

        uint256 amount = lockInfo.amount;
        delete lockedTokens[msg.sender];

        emit TokensUnlocked(msg.sender, amount);
    }

    function lockLiquidity(address lpToken, uint256 amount, uint256 duration) external onlyFactory {
        if (lpToken == address(0)) revert PumpFunToken__ZeroAddress();
        if (amount == 0) revert PumpFunToken__ZeroAmount();
        if (duration < MIN_LOCK_DURATION) revert PumpFunToken__InvalidLockDuration(duration);

        // IERC20(lpToken).transferFrom(msg.sender, address(this), amount);

        uint256 unlockTime = block.timestamp + duration;
        liquidityLocks[lpToken] = LockInfo({amount: amount, unlockTime: unlockTime, isLocked: true});

        emit LiquidityLocked(lpToken, amount, unlockTime);
    }

    function transferAirdrop(address[] calldata recipients, uint256[] calldata amounts) external {
        if (msg.sender != governanceContract) revert PumpFunToken__OnlyGovernance();
        if (airdropContract == address(0)) revert PumpFunToken__InvalidAirdropContract();
        if (recipients.length != amounts.length) revert PumpFunToken__InvalidAirdropArrays();

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) revert PumpFunToken__ZeroAmount();
            totalAmount += amounts[i];
        }
        if (balanceOf(address(this)) < totalAmount) {
            revert PumpFunToken__InsufficientBalance(balanceOf(address(this)), totalAmount);
        }

        _transfer(address(this), airdropContract, totalAmount);
        emit AirdropTriggered(airdropContract, totalAmount);
    }

    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Pausable) {
        if (from != address(0) && to != address(0)) _checkTransferRestrictions(from, to, amount);
        super._update(from, to, amount);
    }

    function _checkTransferRestrictions(address from, address to, uint256 amount) internal {
        if (
            lockedTokens[from].isLocked && lockedTokens[from].amount >= amount
                && block.timestamp < lockedTokens[from].unlockTime
        ) revert PumpFunToken__TransferLocked(from, amount, lockedTokens[from].unlockTime);

        if (isWhitelisted[from] || isWhitelisted[to]) return;

        if (transferLimitsEnabled) {
            if (amount > maxTransferAmount) revert PumpFunToken__ExceedsMaxTransferAmount(amount, maxTransferAmount);
            if (balanceOf(to) + amount > maxHolding) {
                revert PumpFunToken__ExceedsMaxHolding(balanceOf(to) + amount, maxHolding);
            }
            if (block.timestamp < lastTransferTime[from] + TRANSFER_COOLDOWN) {
                revert PumpFunToken__TransferLocked(from, amount, lastTransferTime[from] + TRANSFER_COOLDOWN);
            }
        }

        lastTransferTime[from] = block.timestamp;
    }

    function stabilityMint(uint256 amount, uint256 currentPrice) external onlyOwner {
        if (!mintingEnabled) revert PumpFunToken__MintingPaused();
        if (amount == 0) revert PumpFunToken__InvalidMintAmount(amount);
        if (totalSupply() + amount > MAX_SUPPLY) revert PumpFunToken__InvalidMintAmount(amount);

        if (currentPrice > targetPrice && totalSupply() < stabilityThreshold) {
            _mint(address(this), amount);
            emit StabilityMint(amount, currentPrice);
        }
    }

    function stabilityBurn(uint256 amount, uint256 currentPrice) external onlyOwner {
        if (!burningEnabled) revert PumpFunToken__BurningPaused();
        if (amount == 0) revert PumpFunToken__ZeroAmount();
        if (balanceOf(address(this)) < amount) {
            revert PumpFunToken__InsufficientBalance(balanceOf(address(this)), amount);
        }

        if (currentPrice < targetPrice) {
            _burn(address(this), amount);
            emit StabilityBurn(amount, currentPrice);
        }
    }

    function getPoolBalances() external view returns (uint256 liquidityBalance, uint256 dexBalance) {
        return (liquidityPoolBalance, dexPoolBalance);
    }

    function deductLiquidityPoolBalance(uint256 amount) external onlyFactory {
        if (amount > liquidityPoolBalance) revert PumpFunToken__InsufficientBalance(liquidityPoolBalance, amount);
        liquidityPoolBalance -= amount;
    }

    function deductDexPoolBalance(uint256 amount) external onlyFactory {
        if (amount > dexPoolBalance) revert PumpFunToken__InsufficientBalance(dexPoolBalance, amount);
        dexPoolBalance -= amount;
    }

    function setMaxTransferAmount(uint256 newAmount) external onlyOwner {
        uint256 oldAmount = maxTransferAmount;
        maxTransferAmount = newAmount;
        emit MaxTransferAmountUpdated(oldAmount, newAmount);
    }

    function setMaxHolding(uint256 newAmount) external onlyOwner {
        uint256 oldAmount = maxHolding;
        maxHolding = newAmount;
        emit MaxHoldingUpdated(oldAmount, newAmount);
    }

    function setWhitelisted(address account, bool whitelisted) external onlyOwner {
        isWhitelisted[account] = whitelisted;
    }

    function setTransferLimitsEnabled(bool enabled) external onlyOwner {
        transferLimitsEnabled = enabled;
    }

    function setMintingEnabled(bool enabled) external onlyOwner {
        mintingEnabled = enabled;
    }

    function setBurningEnabled(bool enabled) external onlyOwner {
        burningEnabled = enabled;
    }

    function setGovernanceContract(address _governanceContract) external onlyFactory {
        if (_governanceContract == address(0)) revert PumpFunToken__ZeroAddress();
        address oldGovernance = governanceContract;
        governanceContract = _governanceContract;
        emit GovernanceContractUpdated(address(this), oldGovernance, _governanceContract);
    }

    function getLockedTokens(address holder)
        external
        view
        returns (uint256 amount, uint256 unlockTime, bool isLocked)
    {
        LockInfo memory lockInfo = lockedTokens[holder];
        return (lockInfo.amount, lockInfo.unlockTime, lockInfo.isLocked);
    }

    function getAvailableBalance(address holder) external view returns (uint256) {
        uint256 balance = balanceOf(holder);
        LockInfo memory lockInfo = lockedTokens[holder];

        if (lockInfo.isLocked && block.timestamp < lockInfo.unlockTime) {
            return balance > lockInfo.amount ? balance - lockInfo.amount : 0;
        }

        return balance;
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function emergencyUnpause() external onlyOwner {
        _unpause();
    }

    function emergencyUnlockLiquidity(address lpToken) external onlyOwner {
        LockInfo storage lockInfo = liquidityLocks[lpToken];
        if (!lockInfo.isLocked) revert PumpFunToken__NoLockedTokens(lpToken);
        if (block.timestamp <= lockInfo.unlockTime + 30 days) {
            revert PumpFunToken__LockNotExpired(lockInfo.unlockTime + 30 days);
        }

        IERC20(lpToken).transfer(owner(), lockInfo.amount);
        delete liquidityLocks[lpToken];
    }
}
