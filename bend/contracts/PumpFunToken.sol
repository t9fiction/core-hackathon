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
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance(uint256 available, uint256 requested);
    error TransferLocked(address holder, uint256 amount, uint256 unlockTime);
    error ExceedsMaxTransferAmount(uint256 amount, uint256 maxAmount);
    error ExceedsMaxHolding(uint256 amount, uint256 maxHolding);
    error InvalidLockDuration(uint256 duration);
    error TokensAlreadyLocked(address holder);
    error NoLockedTokens(address holder);
    error LockNotExpired(uint256 unlockTime);
    error InvalidMintAmount(uint256 amount);
    error MintingPaused();
    error BurningPaused();
    error InvalidName();
    error InvalidSymbol();
    error OnlyFactory();
    error OnlyGovernance();
    error InvalidAirdropArrays();
    error InvalidAirdropContract();

    event TokensLocked(address indexed holder, uint256 amount, uint256 unlockTime);
    event TokensUnlocked(address indexed holder, uint256 amount);
    event MaxTransferAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event MaxHoldingUpdated(uint256 oldAmount, uint256 newAmount);
    event LiquidityLocked(address indexed lpToken, uint256 amount, uint256 unlockTime);
    event StabilityMint(uint256 amount, uint256 price);
    event StabilityBurn(uint256 amount, uint256 price);
    event GovernanceContractUpdated(address indexed token, address indexed oldGovernance, address indexed newGovernance);
    event AirdropTriggered(address indexed airdropContract, uint256 totalAmount);
    event ContractApprovedSpender(address indexed spender, uint256 amount);

    struct LockInfo {
        uint256 amount;
        uint256 unlockTime;
        bool isLocked;
    }

    mapping(address => LockInfo) public lockedTokens;
    mapping(address => uint256) public lastTransferTime;
    mapping(address => bool) public isWhitelisted;

    uint256 public constant MIN_LOCK_DURATION = 1 days;
    uint256 public constant MAX_LOCK_DURATION = 365 days;
    uint256 public constant TRANSFER_COOLDOWN = 1 hours;

    uint256 public immutable MAX_SUPPLY;

    uint256 public maxTransferAmount;
    uint256 public maxHolding;
    uint256 public stabilityThreshold = 1000000 * 10**18;
    uint256 public targetPrice = 1 * 10**18;

    bool public transferLimitsEnabled = true;
    bool public mintingEnabled = true;
    bool public burningEnabled = true;

    mapping(address => LockInfo) public liquidityLocks;

    address public governanceContract;
    address public immutable airdropContract;
    address public immutable factory;

    constructor(
        string memory name,
        string memory symbol,
        uint256 _initialSupply,
        address _creator,
        address _factory
    ) ERC20(name, symbol) Ownable(_creator) {
        if (bytes(name).length == 0) revert InvalidName();
        if (bytes(symbol).length == 0) revert InvalidSymbol();
        if (_initialSupply == 0) revert ZeroAmount();
        if (_creator == address(0) || _factory == address(0)) revert ZeroAddress();

        factory = _factory;
        airdropContract = IPumpFunFactoryLite(_factory).getAirdropContract();
        if (airdropContract == address(0)) revert InvalidAirdropContract();

        MAX_SUPPLY = _initialSupply * 10**decimals();

        uint256 initialSupply = _initialSupply * 10**decimals();
        uint256 creatorAmount = (initialSupply * 10) / 100;
        uint256 liquidityAmount = (initialSupply * 20) / 100;
        uint256 communityAmount = initialSupply - creatorAmount - liquidityAmount;

        _mint(_creator, creatorAmount);
        _mint(address(this), liquidityAmount + communityAmount);

        // Auto-approve factory for liquidity allocation
        _approve(address(this), _factory, liquidityAmount);
        emit ContractApprovedSpender(_factory, liquidityAmount);

        maxTransferAmount = (initialSupply * 1) / 100;
        maxHolding = (initialSupply * 5) / 100;

        isWhitelisted[address(this)] = true;
        isWhitelisted[_factory] = true;
        isWhitelisted[airdropContract] = true;
    }

    function approveContractSpender(address spender, uint256 amount) external onlyOwner {
        if (spender == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (balanceOf(address(this)) < amount) revert InsufficientBalance(balanceOf(address(this)), amount);
        _approve(address(this), spender, amount);
        emit ContractApprovedSpender(spender, amount);
    }

    // Supply Locking Functions

    function lockTokens(uint256 amount, uint256 duration) external {
        if (amount == 0) revert ZeroAmount();
        if (duration < MIN_LOCK_DURATION || duration > MAX_LOCK_DURATION) {
            revert InvalidLockDuration(duration);
        }
        if (lockedTokens[msg.sender].isLocked) {
            revert TokensAlreadyLocked(msg.sender);
        }
        if (balanceOf(msg.sender) < amount) {
            revert InsufficientBalance(balanceOf(msg.sender), amount);
        }

        uint256 unlockTime = block.timestamp + duration;
        lockedTokens[msg.sender] = LockInfo({
            amount: amount,
            unlockTime: unlockTime,
            isLocked: true
        });

        emit TokensLocked(msg.sender, amount, unlockTime);
    }

    function unlockTokens() external {
        LockInfo storage lockInfo = lockedTokens[msg.sender];
        if (!lockInfo.isLocked) revert NoLockedTokens(msg.sender);
        if (block.timestamp < lockInfo.unlockTime) {
            revert LockNotExpired(lockInfo.unlockTime);
        }

        uint256 amount = lockInfo.amount;
        delete lockedTokens[msg.sender];

        emit TokensUnlocked(msg.sender, amount);
    }

    function lockLiquidity(address lpToken, uint256 amount, uint256 duration) external onlyOwner {
        if (lpToken == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (duration < MIN_LOCK_DURATION) revert InvalidLockDuration(duration);

        IERC20(lpToken).transferFrom(msg.sender, address(this), amount);

        uint256 unlockTime = block.timestamp + duration;
        liquidityLocks[lpToken] = LockInfo({
            amount: amount,
            unlockTime: unlockTime,
            isLocked: true
        });

        emit LiquidityLocked(lpToken, amount, unlockTime);
    }

    // Airdrop Functions

    function transferAirdrop(address[] calldata recipients, uint256[] calldata amounts) external {
        if (msg.sender != governanceContract) revert OnlyGovernance();
        if (airdropContract == address(0)) revert InvalidAirdropContract();
        if (recipients.length != amounts.length) revert InvalidAirdropArrays();

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) revert ZeroAmount();
            totalAmount += amounts[i];
        }
        if (balanceOf(address(this)) < totalAmount) {
            revert InsufficientBalance(balanceOf(address(this)), totalAmount);
        }

        _transfer(address(this), airdropContract, totalAmount);
        emit AirdropTriggered(airdropContract, totalAmount);
    }

    // Anti-Rug Pull Functions

    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Pausable) {
        if (from != address(0) && to != address(0)) {
            _checkTransferRestrictions(from, to, amount);
        }
        super._update(from, to, amount);
    }

    function _checkTransferRestrictions(address from, address to, uint256 amount) internal {
        if (lockedTokens[from].isLocked && 
            lockedTokens[from].amount >= amount && 
            block.timestamp < lockedTokens[from].unlockTime) {
            revert TransferLocked(from, amount, lockedTokens[from].unlockTime);
        }

        if (isWhitelisted[from] || isWhitelisted[to]) {
            return;
        }

        if (transferLimitsEnabled) {
            if (amount > maxTransferAmount) {
                revert ExceedsMaxTransferAmount(amount, maxTransferAmount);
            }
            if (balanceOf(to) + amount > maxHolding) {
                revert ExceedsMaxHolding(balanceOf(to) + amount, maxHolding);
            }
            if (block.timestamp < lastTransferTime[from] + TRANSFER_COOLDOWN) {
                revert TransferLocked(from, amount, lastTransferTime[from] + TRANSFER_COOLDOWN);
            }
        }

        lastTransferTime[from] = block.timestamp;
    }

    // Stability Functions

    function stabilityMint(uint256 amount, uint256 currentPrice) external onlyOwner {
        if (!mintingEnabled) revert MintingPaused();
        if (amount == 0) revert InvalidMintAmount(amount);
        if (totalSupply() + amount > MAX_SUPPLY) revert InvalidMintAmount(amount);

        if (currentPrice > targetPrice && totalSupply() < stabilityThreshold) {
            _mint(address(this), amount);
            emit StabilityMint(amount, currentPrice);
        }
    }

    function stabilityBurn(uint256 amount, uint256 currentPrice) external onlyOwner {
        if (!burningEnabled) revert BurningPaused();
        if (amount == 0) revert ZeroAmount();
        if (balanceOf(address(this)) < amount) {
            revert InsufficientBalance(balanceOf(address(this)), amount);
        }

        if (currentPrice < targetPrice) {
            _burn(address(this), amount);
            emit StabilityBurn(amount, currentPrice);
        }
    }

    // Admin Functions

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

    function setGovernanceContract(address _governanceContract) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (_governanceContract == address(0)) revert ZeroAddress();
        address oldGovernance = governanceContract;
        governanceContract = _governanceContract;
        emit GovernanceContractUpdated(address(this), oldGovernance, _governanceContract);
    }

    // View Functions

    function getLockedTokens(address holder) external view returns (uint256 amount, uint256 unlockTime, bool isLocked) {
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

    // Emergency Functions

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function emergencyUnpause() external onlyOwner {
        _unpause();
    }

    function emergencyUnlockLiquidity(address lpToken) external onlyOwner {
        LockInfo storage lockInfo = liquidityLocks[lpToken];
        if (!lockInfo.isLocked) revert NoLockedTokens(lpToken);
        if (block.timestamp <= lockInfo.unlockTime + 30 days) revert LockNotExpired(lockInfo.unlockTime + 30 days);

        IERC20(lpToken).transfer(owner(), lockInfo.amount);
        delete liquidityLocks[lpToken];
    }
}