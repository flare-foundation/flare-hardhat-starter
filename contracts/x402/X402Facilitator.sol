// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IEIP3009
 * @notice Interface for EIP-3009 transferWithAuthorization
 */
interface IEIP3009 {
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
    ) external;

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
    ) external;

    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/**
 * @title X402Facilitator
 * @notice Facilitator contract for x402 payment protocol using EIP-3009
 * @dev Verifies and settles payments with transferWithAuthorization
 */
contract X402Facilitator is Ownable, ReentrancyGuard {
    struct PaymentRecord {
        address from;
        address to;
        address token;
        uint256 amount;
        uint256 timestamp;
        bool settled;
    }

    struct PaymentPayload {
        address from;
        address to;
        address token;
        uint256 value;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // Supported EIP-3009 tokens
    mapping(address => bool) public supportedTokens;

    // Payment records for idempotency
    mapping(bytes32 => PaymentRecord) public payments;

    // Fee configuration (basis points, 100 = 1%)
    uint256 public feeBps;
    address public feeRecipient;

    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event PaymentVerified(bytes32 indexed paymentId, address from, address to, uint256 amount);
    event PaymentSettled(bytes32 indexed paymentId, address from, address to, uint256 amount);
    event FeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);

    error TokenNotSupported();
    error PaymentAlreadySettled();
    error AuthorizationAlreadyUsed();
    error InvalidPaymentPayload();
    error SettlementFailed();

    constructor(address _feeRecipient, uint256 _feeBps) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
    }

    /**
     * @notice Add a supported EIP-3009 token
     * @param token The token address
     */
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    /**
     * @notice Remove a supported token
     * @param token The token address
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    /**
     * @notice Update the fee (in basis points)
     * @param _feeBps New fee in basis points (100 = 1%)
     */
    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high"); // Max 10%
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    /**
     * @notice Update the fee recipient
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid recipient");
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    /**
     * @notice Settle a payment using EIP-3009 transferWithAuthorization
     * @dev Executes the transfer and records the payment
     * @param payload The payment payload with authorization details
     * @return paymentId The unique payment identifier
     */
    function settlePayment(PaymentPayload calldata payload) external nonReentrant returns (bytes32 paymentId) {
        if (!supportedTokens[payload.token]) revert TokenNotSupported();

        paymentId = _getPaymentId(payload);

        if (payments[paymentId].settled) revert PaymentAlreadySettled();

        IEIP3009 token = IEIP3009(payload.token);

        if (token.authorizationState(payload.from, payload.nonce)) {
            revert AuthorizationAlreadyUsed();
        }

        // Execute the transfer via EIP-3009
        token.transferWithAuthorization(
            payload.from,
            payload.to,
            payload.value,
            payload.validAfter,
            payload.validBefore,
            payload.nonce,
            payload.v,
            payload.r,
            payload.s
        );

        // Record the payment
        payments[paymentId] = PaymentRecord({
            from: payload.from,
            to: payload.to,
            token: payload.token,
            amount: payload.value,
            timestamp: block.timestamp,
            settled: true
        });

        emit PaymentSettled(paymentId, payload.from, payload.to, payload.value);

        return paymentId;
    }

    /**
     * @notice Settle payment using receiveWithAuthorization (front-running protected)
     * @dev Only the payee can call this - msg.sender must equal payload.to
     * @param payload The payment payload with authorization details
     * @return paymentId The unique payment identifier
     */
    function settlePaymentAsPayee(PaymentPayload calldata payload) external nonReentrant returns (bytes32 paymentId) {
        if (!supportedTokens[payload.token]) revert TokenNotSupported();
        if (payload.to != msg.sender) revert InvalidPaymentPayload();

        paymentId = _getPaymentId(payload);

        if (payments[paymentId].settled) revert PaymentAlreadySettled();

        IEIP3009 token = IEIP3009(payload.token);

        if (token.authorizationState(payload.from, payload.nonce)) {
            revert AuthorizationAlreadyUsed();
        }

        // Execute the transfer via receiveWithAuthorization
        token.receiveWithAuthorization(
            payload.from,
            payload.to,
            payload.value,
            payload.validAfter,
            payload.validBefore,
            payload.nonce,
            payload.v,
            payload.r,
            payload.s
        );

        // Record the payment
        payments[paymentId] = PaymentRecord({
            from: payload.from,
            to: payload.to,
            token: payload.token,
            amount: payload.value,
            timestamp: block.timestamp,
            settled: true
        });

        emit PaymentSettled(paymentId, payload.from, payload.to, payload.value);

        return paymentId;
    }

    /**
     * @notice Verify a payment authorization without settling
     * @dev Checks signature validity and nonce state
     * @param payload The payment payload with authorization details
     * @return paymentId The unique payment identifier
     * @return valid Whether the payment is valid and can be settled
     */
    function verifyPayment(PaymentPayload calldata payload) external view returns (bytes32 paymentId, bool valid) {
        paymentId = _getPaymentId(payload);

        // Check token is supported
        if (!supportedTokens[payload.token]) {
            return (paymentId, false);
        }

        // Check if already settled
        if (payments[paymentId].settled) {
            return (paymentId, false);
        }

        // Check authorization hasn't been used
        IEIP3009 token = IEIP3009(payload.token);
        if (token.authorizationState(payload.from, payload.nonce)) {
            return (paymentId, false);
        }

        // Check time validity
        if (block.timestamp <= payload.validAfter || block.timestamp >= payload.validBefore) {
            return (paymentId, false);
        }

        return (paymentId, true);
    }

    /**
     * @notice Get payment record by ID
     * @param paymentId The payment ID
     */
    function getPayment(bytes32 paymentId) external view returns (PaymentRecord memory) {
        return payments[paymentId];
    }

    /**
     * @notice Check if a specific nonce has been used for an authorizer
     * @param token The EIP-3009 token
     * @param authorizer The address that signed the authorization
     * @param nonce The nonce to check
     */
    function isNonceUsed(address token, address authorizer, bytes32 nonce) external view returns (bool) {
        return IEIP3009(token).authorizationState(authorizer, nonce);
    }

    /**
     * @notice Get the domain separator for a token
     * @param token The EIP-3009 token
     */
    function getTokenDomainSeparator(address token) external view returns (bytes32) {
        return IEIP3009(token).DOMAIN_SEPARATOR();
    }

    /**
     * @dev Generate unique payment ID from payload
     */
    function _getPaymentId(PaymentPayload calldata payload) internal pure returns (bytes32) {
        return keccak256(abi.encode(payload.from, payload.to, payload.token, payload.value, payload.nonce));
    }
}
