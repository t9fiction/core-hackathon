[dotenv@17.0.1] injecting env (9) from .env – [tip] encrypt with dotenvx: https://dotenvx.com
// Sources flattened with hardhat v2.25.0 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/interfaces/draft-IERC6093.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (interfaces/draft-IERC6093.sol)
pragma solidity ^0.8.20;

/**
 * @dev Standard ERC-20 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-20 tokens.
 */
interface IERC20Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC20InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC20InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `spender`’s `allowance`. Used in transfers.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     * @param allowance Amount of tokens a `spender` is allowed to operate with.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC20InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `spender` to be approved. Used in approvals.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC20InvalidSpender(address spender);
}

/**
 * @dev Standard ERC-721 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-721 tokens.
 */
interface IERC721Errors {
    /**
     * @dev Indicates that an address can't be an owner. For example, `address(0)` is a forbidden owner in ERC-20.
     * Used in balance queries.
     * @param owner Address of the current owner of a token.
     */
    error ERC721InvalidOwner(address owner);

    /**
     * @dev Indicates a `tokenId` whose `owner` is the zero address.
     * @param tokenId Identifier number of a token.
     */
    error ERC721NonexistentToken(uint256 tokenId);

    /**
     * @dev Indicates an error related to the ownership over a particular token. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param tokenId Identifier number of a token.
     * @param owner Address of the current owner of a token.
     */
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC721InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC721InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param tokenId Identifier number of a token.
     */
    error ERC721InsufficientApproval(address operator, uint256 tokenId);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC721InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC721InvalidOperator(address operator);
}

/**
 * @dev Standard ERC-1155 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC-1155 tokens.
 */
interface IERC1155Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     * @param tokenId Identifier number of a token.
     */
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC1155InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC1155InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param owner Address of the current owner of a token.
     */
    error ERC1155MissingApprovalForAll(address operator, address owner);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC1155InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC1155InvalidOperator(address operator);

    /**
     * @dev Indicates an array length mismatch between ids and values in a safeBatchTransferFrom operation.
     * Used in batch transfers.
     * @param idsLength Length of the array of token identifiers
     * @param valuesLength Length of the array of token amounts
     */
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);
}


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}


// File @openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/extensions/IERC20Metadata.sol)

pragma solidity ^0.8.20;

/**
 * @dev Interface for the optional metadata functions from the ERC-20 standard.
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}


// File @openzeppelin/contracts/token/ERC20/ERC20.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.3.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.20;




/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.openzeppelin.com/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * The default value of {decimals} is 18. To change this, you should override
 * this function so it returns a different value.
 *
 * We have followed general OpenZeppelin Contracts guidelines: functions revert
 * instead returning `false` on failure. This behavior is nonetheless
 * conventional and does not conflict with the expectations of ERC-20
 * applications.
 */
abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;

    mapping(address account => mapping(address spender => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * Both values are immutable: they can only be set once during construction.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the default value returned by this function, unless
     * it's overridden.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Skips emitting an {Approval} event indicating an allowance update. This is not
     * required by the ERC. See {xref-ERC20-_approve-address-address-uint256-bool-}[_approve].
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `value`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `value`.
     */
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply.
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    /**
     * @dev Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
     * Relies on the `_update` mechanism
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _mint(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, value);
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, lowering the total supply.
     * Relies on the `_update` mechanism.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead
     */
    function _burn(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), value);
    }

    /**
     * @dev Sets `value` as the allowance of `spender` over the `owner`'s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     *
     * Overrides to this logic should be done to the variant with an additional `bool emitEvent` argument.
     */
    function _approve(address owner, address spender, uint256 value) internal {
        _approve(owner, spender, value, true);
    }

    /**
     * @dev Variant of {_approve} with an optional flag to enable or disable the {Approval} event.
     *
     * By default (when calling {_approve}) the flag is set to true. On the other hand, approval changes made by
     * `_spendAllowance` during the `transferFrom` operation set the flag to false. This saves gas by not emitting any
     * `Approval` event during `transferFrom` operations.
     *
     * Anyone who wishes to continue emitting `Approval` events on the`transferFrom` operation can force the flag to
     * true using the following override:
     *
     * ```solidity
     * function _approve(address owner, address spender, uint256 value, bool) internal virtual override {
     *     super._approve(owner, spender, value, true);
     * }
     * ```
     *
     * Requirements are the same as {_approve}.
     */
    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        _allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    /**
     * @dev Updates `owner`'s allowance for `spender` based on spent `value`.
     *
     * Does not update the allowance value in case of infinite allowance.
     * Revert if not enough allowance is available.
     *
     * Does not emit an {Approval} event.
     */
    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance < type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }
}


// File @openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/extensions/ERC20Burnable.sol)

pragma solidity ^0.8.20;


/**
 * @dev Extension of {ERC20} that allows token holders to destroy both their own
 * tokens and those that they have an allowance for, in a way that can be
 * recognized off-chain (via event analysis).
 */
abstract contract ERC20Burnable is Context, ERC20 {
    /**
     * @dev Destroys a `value` amount of tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 value) public virtual {
        _burn(_msgSender(), value);
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, deducting from
     * the caller's allowance.
     *
     * See {ERC20-_burn} and {ERC20-allowance}.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `value`.
     */
    function burnFrom(address account, uint256 value) public virtual {
        _spendAllowance(account, _msgSender(), value);
        _burn(account, value);
    }
}


// File @openzeppelin/contracts/token/ERC721/IERC721Receiver.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC721/IERC721Receiver.sol)

pragma solidity ^0.8.20;

/**
 * @title ERC-721 token receiver interface
 * @dev Interface for any contract that wants to support safeTransfers
 * from ERC-721 asset contracts.
 */
interface IERC721Receiver {
    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be
     * reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}


// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.3.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}


// File contracts/ChainCraftToken.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;



contract ChainCraftToken is ERC20, ERC20Burnable, Ownable {
    // Custom Errors
    error ChainCraftToken__ZeroAddress();
    error ChainCraftToken__ZeroAmount();
    error ChainCraftToken__InvalidName();
    error ChainCraftToken__InvalidSymbol();
    error ChainCraftToken__TransferLimitExceeded(uint256 amount, uint256 limit);
    error ChainCraftToken__HoldingLimitExceeded(uint256 balance, uint256 limit);

    // Events
    event TokenCreated(address indexed creator, uint256 totalSupply);
    
    // Anti-Rug Protection Constants
    uint256 public constant TRANSFER_LIMIT_PERCENT = 5; // 5% of total supply
    uint256 public constant HOLDING_LIMIT_PERCENT = 5;  // 5% of total supply
    
    // State Variables
    address public factoryAddress;

    constructor(
        string memory name, 
        string memory symbol, 
        uint256 _totalSupply, 
        address _creator
    )
        ERC20(name, symbol)
        Ownable(_creator)
    {
        if (bytes(name).length == 0) revert ChainCraftToken__InvalidName();
        if (bytes(symbol).length == 0) revert ChainCraftToken__InvalidSymbol();
        if (_totalSupply == 0) revert ChainCraftToken__ZeroAmount();
        if (_creator == address(0)) revert ChainCraftToken__ZeroAddress();

        uint256 totalSupply = _totalSupply * 10 ** decimals();
        
        // Store factory address (msg.sender is the factory)
        factoryAddress = msg.sender;
        
        // Mint ALL tokens to the creator/owner
        _mint(_creator, totalSupply);
        
        emit TokenCreated(_creator, totalSupply);
    }
    
    /**
     * @dev Override transfer to implement anti-rug protection
     */
    function _update(address from, address to, uint256 value) internal override {
        // Skip limits for minting/burning
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        
        // Skip limits for factory, owner, and transfers between them
        if (_isExemptFromLimits(from) || _isExemptFromLimits(to)) {
            super._update(from, to, value);
            return;
        }
        
        // Check transfer limit (5% of total supply)
        uint256 maxTransfer = (totalSupply() * TRANSFER_LIMIT_PERCENT) / 100;
        if (value > maxTransfer) {
            revert ChainCraftToken__TransferLimitExceeded(value, maxTransfer);
        }
        
        // Check holding limit for recipient (5% of total supply)
        uint256 maxHolding = (totalSupply() * HOLDING_LIMIT_PERCENT) / 100;
        uint256 newBalance = balanceOf(to) + value;
        if (newBalance > maxHolding) {
            revert ChainCraftToken__HoldingLimitExceeded(newBalance, maxHolding);
        }
        
        super._update(from, to, value);
    }
    
    /**
     * @dev Check if address is exempt from limits
     */
    function _isExemptFromLimits(address account) internal view returns (bool) {
        return account == owner() || account == factoryAddress;
    }
    
    /**
     * @dev Get current transfer limit
     */
    function getTransferLimit() external view returns (uint256) {
        return (totalSupply() * TRANSFER_LIMIT_PERCENT) / 100;
    }
    
    /**
     * @dev Get current holding limit
     */
    function getHoldingLimit() external view returns (uint256) {
        return (totalSupply() * HOLDING_LIMIT_PERCENT) / 100;
    }
}


// File contracts/ChainCraftFactoryLite.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;





contract ChainCraftFactoryLite is Ownable, ReentrancyGuard, IERC721Receiver {
    // Custom Errors
    error ChainCraftFactoryLite__InsufficientEtherFee(uint256 sent, uint256 required);
    error ChainCraftFactoryLite__InvalidParameters();
    error ChainCraftFactoryLite__NoEtherToWithdraw();
    error ChainCraftFactoryLite__TransferFailed();
    error ChainCraftFactoryLite__InvalidFeeAmount(uint256 fee);
    error ChainCraftFactoryLite__EmptyStringParameter();
    error ChainCraftFactoryLite__TotalSupplyTooLow();
    error ChainCraftFactoryLite__TotalSupplyTooHigh(uint256 supply, uint256 maxSupply);
    error ChainCraftFactoryLite__TokenNotDeployedByFactory();
    error ChainCraftFactoryLite__InvalidTokenAmount();
    error ChainCraftFactoryLite__OnlyTokenOwner();
    error ChainCraftFactoryLite__TokenAlreadyLocked();
    error ChainCraftFactoryLite__TokenNotLocked();
    error ChainCraftFactoryLite__LockNotExpired();
    error ChainCraftFactoryLite__InvalidLockDuration();
    error ChainCraftFactoryLite__InsufficientTokenBalance();
    error ChainCraftFactoryLite__NotTokenCreator();

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
    event TokensLocked(
        address indexed token,
        address indexed owner,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 lockDuration,
        uint256 unlockTime,
        string description
    );
    event TokensUnlocked(
        address indexed token,
        address indexed owner,
        uint256 tokenAmount,
        uint256 ethAmount
    );

    // Structs
    struct TokenInfo {
        address tokenAddress;
        address creator;
        uint256 deploymentTime;
    }

    struct TokenLock {
        address tokenAddress;
        address owner;
        uint256 tokenAmount;
        uint256 ethAmount;
        uint256 lockTime;
        uint256 unlockTime;
        uint256 lockDuration;
        string description;
        bool isActive;
    }

    // State Variables
    uint256 public etherFee = 0.05 ether; // Base fee is now 0.05 ETH
    uint256 public constant MAX_FEE = 1 ether;
    uint256 public constant MIN_TOTAL_SUPPLY = 1000;

    // Tiered max supply limits
    uint256 public constant STANDARD_MAX_SUPPLY = 100000000; // 100M tokens
    uint256 public constant PREMIUM_MAX_SUPPLY = 500000000; // 500M tokens
    uint256 public constant ULTIMATE_MAX_SUPPLY = 1000000000; // 1B tokens

    // Fee multipliers
    uint256 public constant STANDARD_FEE_MULTIPLIER = 1;  // 0.05 * 1 = 0.05 ETH
    uint256 public constant PREMIUM_FEE_MULTIPLIER = 5;   // 0.05 * 5 = 0.25 ETH
    uint256 public constant ULTIMATE_FEE_MULTIPLIER = 10; // 0.05 * 10 = 0.5 ETH

    // Token Lock constants
    uint256 public constant MIN_LOCK_DURATION = 1 days;
    uint256 public constant MAX_LOCK_DURATION = 365 days;

    // Mappings
    mapping(address => address[]) public creatorTokens;
    mapping(address => bool) public isDeployedToken;
    mapping(address => TokenInfo) public tokenInfo;
    address[] public allDeployedTokens;

    // Token Lock mappings
    mapping(address => TokenLock) public tokenLocks; // token => lock info
    mapping(address => bool) public isTokenLocked;

    // Statistics
    uint256 public totalTokensDeployed;
    uint256 public totalFeesCollected;

    constructor() Ownable(msg.sender) {}

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
        if (msg.value < requiredFee) revert ChainCraftFactoryLite__InsufficientEtherFee(msg.value, requiredFee);
        if (msg.value > requiredFee) payable(msg.sender).transfer(msg.value - requiredFee);

        // Deploy token - all tokens minted to creator
        ChainCraftToken token = new ChainCraftToken(name, symbol, totalSupply, msg.sender);
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
     * @dev Validate token deployment parameters
     */
    function _validateTokenParameters(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) internal pure {
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert ChainCraftFactoryLite__EmptyStringParameter();
        if (totalSupply < MIN_TOTAL_SUPPLY) revert ChainCraftFactoryLite__TotalSupplyTooLow();
        if (totalSupply > ULTIMATE_MAX_SUPPLY) {
            revert ChainCraftFactoryLite__TotalSupplyTooHigh(totalSupply, ULTIMATE_MAX_SUPPLY);
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
        if (newFee > MAX_FEE) revert ChainCraftFactoryLite__InvalidFeeAmount(newFee);
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
        if (balance == 0) revert ChainCraftFactoryLite__NoEtherToWithdraw();
        (bool success,) = payable(owner()).call{value: balance}("");
        if (!success) revert ChainCraftFactoryLite__TransferFailed();
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

    /**
     * @dev Lock tokens with ETH collateral to build community trust
     * Only the token creator/owner can lock tokens
     */
    function lockTokens(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 lockDuration,
        string memory description
    ) external payable nonReentrant {
        // Validate inputs
        if (!isDeployedToken[tokenAddress]) revert ChainCraftFactoryLite__TokenNotDeployedByFactory();
        if (isTokenLocked[tokenAddress]) revert ChainCraftFactoryLite__TokenAlreadyLocked();
        if (tokenInfo[tokenAddress].creator != msg.sender) revert ChainCraftFactoryLite__OnlyTokenOwner();
        if (lockDuration < MIN_LOCK_DURATION || lockDuration > MAX_LOCK_DURATION) {
            revert ChainCraftFactoryLite__InvalidLockDuration();
        }
        if (tokenAmount == 0) revert ChainCraftFactoryLite__InvalidTokenAmount();
        if (msg.value == 0) revert ChainCraftFactoryLite__InvalidParameters();

        // Check token balance
        IERC20 token = IERC20(tokenAddress);
        if (token.balanceOf(msg.sender) < tokenAmount) revert ChainCraftFactoryLite__InsufficientTokenBalance();

        // Transfer tokens to this contract
        token.transferFrom(msg.sender, address(this), tokenAmount);

        // Create lock
        uint256 unlockTime = block.timestamp + lockDuration;
        tokenLocks[tokenAddress] = TokenLock({
            tokenAddress: tokenAddress,
            owner: msg.sender,
            tokenAmount: tokenAmount,
            ethAmount: msg.value,
            lockTime: block.timestamp,
            unlockTime: unlockTime,
            lockDuration: lockDuration,
            description: description,
            isActive: true
        });
        
        isTokenLocked[tokenAddress] = true;

        emit TokensLocked(
            tokenAddress,
            msg.sender,
            tokenAmount,
            msg.value,
            lockDuration,
            unlockTime,
            description
        );
    }

    /**
     * @dev Unlock tokens after lock period expires
     */
    function unlockTokens(address tokenAddress) external nonReentrant {
        if (!isTokenLocked[tokenAddress]) revert ChainCraftFactoryLite__TokenNotLocked();
        
        TokenLock storage lockInfo = tokenLocks[tokenAddress];
        if (lockInfo.owner != msg.sender) revert ChainCraftFactoryLite__OnlyTokenOwner();
        if (block.timestamp < lockInfo.unlockTime) revert ChainCraftFactoryLite__LockNotExpired();
        if (!lockInfo.isActive) revert ChainCraftFactoryLite__TokenNotLocked();

        // Transfer tokens back to owner
        IERC20(tokenAddress).transfer(msg.sender, lockInfo.tokenAmount);
        
        // Return ETH collateral
        (bool success,) = payable(msg.sender).call{value: lockInfo.ethAmount}("");
        if (!success) revert ChainCraftFactoryLite__TransferFailed();

        // Mark lock as inactive
        lockInfo.isActive = false;
        isTokenLocked[tokenAddress] = false;

        emit TokensUnlocked(
            tokenAddress,
            msg.sender,
            lockInfo.tokenAmount,
            lockInfo.ethAmount
        );
    }

    /**
     * @dev Get token lock information
     */
    function getTokenLock(address tokenAddress) external view returns (TokenLock memory) {
        return tokenLocks[tokenAddress];
    }

    /**
     * @dev Check if token is currently locked
     */
    function isTokenCurrentlyLocked(address tokenAddress) external view returns (bool) {
        if (!isTokenLocked[tokenAddress]) return false;
        TokenLock memory lockInfo = tokenLocks[tokenAddress];
        return lockInfo.isActive && block.timestamp < lockInfo.unlockTime;
    }

    /**
     * @dev Get time remaining until unlock (returns 0 if unlocked or expired)
     */
    function getTimeUntilUnlock(address tokenAddress) external view returns (uint256) {
        if (!isTokenLocked[tokenAddress]) return 0;
        TokenLock memory lockInfo = tokenLocks[tokenAddress];
        if (!lockInfo.isActive || block.timestamp >= lockInfo.unlockTime) return 0;
        return lockInfo.unlockTime - block.timestamp;
    }

    /**
     * @dev Get days remaining until unlock (returns 0 if unlocked or expired)
     */
    function getDaysUntilUnlock(address tokenAddress) external view returns (uint256) {
        uint256 timeRemaining = this.getTimeUntilUnlock(tokenAddress);
        return timeRemaining / 1 days;
    }

    // Receive ETH
    receive() external payable {}
    fallback() external payable {}
}
