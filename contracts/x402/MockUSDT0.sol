// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MockUSDT0
 * @notice ERC20 token with EIP-3009 transferWithAuthorization support
 * @dev Implements EIP-3009 for gasless transfers via signed authorizations
 */
contract MockUSDT0 is ERC20, EIP712 {
    using ECDSA for bytes32;

    // EIP-3009 TypeHash for transferWithAuthorization
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );

    // EIP-3009 TypeHash for receiveWithAuthorization (front-running protected)
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );

    // Mapping of authorizer address => nonce => state (true = used)
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);

    error AuthorizationExpired();
    error AuthorizationNotYetValid();
    error AuthorizationAlreadyUsed();
    error InvalidSignature();
    error CallerMustBePayee();

    constructor() ERC20("Mock USDT0", "mUSDT0") EIP712("Mock USDT0", "1") {
        // Mint initial supply to deployer for testing
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice Execute a transfer with a signed authorization from the sender
     * @dev Anyone can call this function with a valid authorization signature
     * @param from The token holder (signer of the authorization)
     * @param to The recipient of the tokens
     * @param value The amount to transfer
     * @param validAfter Authorization is not valid before this time (unix timestamp)
     * @param validBefore Authorization is not valid after this time (unix timestamp)
     * @param nonce Unique 32-byte nonce chosen by the authorizer
     * @param v Signature component v
     * @param r Signature component r
     * @param s Signature component s
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _transferWithAuthorization(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    /**
     * @notice Execute a transfer with a signed authorization (bytes signature variant)
     * @dev Accepts signature as a single bytes parameter
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) external {
        (uint8 v, bytes32 r, bytes32 s) = _splitSignature(signature);
        _transferWithAuthorization(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    /**
     * @notice Execute a receive with a signed authorization - front-running protected
     * @dev Only the payee (to address) can call this function
     * @param from The token holder (signer of the authorization)
     * @param to The recipient of the tokens (must be msg.sender)
     * @param value The amount to transfer
     * @param validAfter Authorization is not valid before this time (unix timestamp)
     * @param validBefore Authorization is not valid after this time (unix timestamp)
     * @param nonce Unique 32-byte nonce chosen by the authorizer
     * @param v Signature component v
     * @param r Signature component r
     * @param s Signature component s
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (to != msg.sender) revert CallerMustBePayee();
        _transferWithAuthorization(
            RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    /**
     * @notice Execute a receive with a signed authorization (bytes signature variant)
     * @dev Only the payee (to address) can call this function
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) external {
        if (to != msg.sender) revert CallerMustBePayee();
        (uint8 v, bytes32 r, bytes32 s) = _splitSignature(signature);
        _transferWithAuthorization(
            RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    /**
     * @notice Cancel an authorization before it's used
     * @dev Allows the authorizer to cancel an unused authorization
     * @param authorizer The address that signed the authorization
     * @param nonce The nonce to cancel
     * @param v Signature component v
     * @param r Signature component r
     * @param s Signature component s
     */
    function cancelAuthorization(address authorizer, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external {
        if (authorizationState[authorizer][nonce]) revert AuthorizationAlreadyUsed();

        bytes32 structHash = keccak256(
            abi.encode(keccak256("CancelAuthorization(address authorizer,bytes32 nonce)"), authorizer, nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);

        if (signer != authorizer) revert InvalidSignature();

        authorizationState[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }

    /**
     * @notice Mint tokens to an address (for testing)
     * @param to The recipient address
     * @param amount The amount to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Get the EIP-712 domain separator
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Override decimals to match USDT (6 decimals)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @dev Internal function to process transfer authorization
     */
    function _transferWithAuthorization(
        bytes32 typeHash,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        // Check validity window
        if (block.timestamp <= validAfter) revert AuthorizationNotYetValid();
        if (block.timestamp >= validBefore) revert AuthorizationExpired();

        // Check nonce hasn't been used
        if (authorizationState[from][nonce]) revert AuthorizationAlreadyUsed();

        // Construct and verify EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(typeHash, from, to, value, validAfter, validBefore, nonce));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);

        if (signer != from) revert InvalidSignature();

        // Mark nonce as used
        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        // Execute transfer
        _transfer(from, to, value);
    }

    /**
     * @dev Split a signature into v, r, s components
     */
    function _splitSignature(bytes memory signature) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(signature.length == 65, "Invalid signature length");
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
    }
}
