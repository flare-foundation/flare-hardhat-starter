// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title  FxrpLzBridgeShim
/// @notice Minimal-calldata wrapper around a LayerZero OFT Adapter, so Flare
///         smart-account memo-field instructions can trigger a cross-chain
///         bridge within the XRPL per-memo 1024-byte limit.
///
///         The LayerZero `send(SendParam, MessagingFee, address)` calldata is
///         ~484 bytes once ABI-encoded — that alone already exceeds the memo
///         size available after wrapping in `executeUserOp([Call])` and the
///         PackedUserOperation tuple. This contract exposes a slim
///         `bridge(uint256,address,address)` (~100 bytes calldata) that
///         hardcodes the per-route params fixed at deploy time.
///
/// ### Deploy params (Coston2 → Sepolia, FTestXRP):
///   fxrp         = 0x0b6A3645c240605887a5532109323A3E12273dc7
///   oftAdapter   = 0xCd3d2127935Ae82Af54Fc31cCD9D3440dbF46639
///   dstEid       = 40161                // EndpointId.SEPOLIA_V2_TESTNET
///   executorGas  = 200000               // LZ addExecutorLzReceiveOption gas
///
/// ### Caller flow (from a Flare personal smart account):
///   1. `fxrp.approve(shim, amount)`
///   2. `shim.bridge{value: nativeFee}(amount, toOnSepolia, refundAddress)`
///   where `nativeFee` is obtained off-chain via `shim.quote(amount, to)`
///   or directly from the OFT Adapter's `quoteSend`.

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

struct SendParam {
    uint32 dstEid;
    bytes32 to;
    uint256 amountLD;
    uint256 minAmountLD;
    bytes extraOptions;
    bytes composeMsg;
    bytes oftCmd;
}

struct MessagingFee {
    uint256 nativeFee;
    uint256 lzTokenFee;
}

struct MessagingReceipt {
    bytes32 guid;
    uint64 nonce;
    MessagingFee fee;
}

struct OFTReceipt {
    uint256 amountSentLD;
    uint256 amountReceivedLD;
}

interface IOFT {
    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory, OFTReceipt memory);

    function quoteSend(SendParam calldata _sendParam, bool _payInLzToken) external view returns (MessagingFee memory);
}

contract FxrpLzBridgeShim {
    address public immutable fxrp;
    address public immutable oftAdapter;
    uint32 public immutable dstEid;
    uint128 public immutable executorGas;

    error TransferFromFailed();
    error ApproveFailed();

    constructor(address _fxrp, address _oftAdapter, uint32 _dstEid, uint128 _executorGas) {
        fxrp = _fxrp;
        oftAdapter = _oftAdapter;
        dstEid = _dstEid;
        executorGas = _executorGas;
    }

    /// @notice Quote the LayerZero native fee for bridging `amount` FXRP to
    ///         `to` on the destination chain configured at deploy time.
    function quote(uint256 amount, address to) external view returns (uint256 nativeFee) {
        MessagingFee memory fee = IOFT(oftAdapter).quoteSend(_buildSendParam(amount, to), false);
        return fee.nativeFee;
    }

    /// @notice Bridge `amount` FXRP from the caller to `to` on the destination
    ///         chain. Caller must first approve this contract for `amount` FXRP
    ///         and must pass `msg.value` equal to the native fee returned by
    ///         `quote(amount, to)`. Any excess native value is refunded by the
    ///         OFT Adapter directly to `refundAddress`.
    function bridge(uint256 amount, address to, address refundAddress) external payable {
        if (!IERC20(fxrp).transferFrom(msg.sender, address(this), amount)) revert TransferFromFailed();
        if (!IERC20(fxrp).approve(oftAdapter, amount)) revert ApproveFailed();
        IOFT(oftAdapter).send{ value: msg.value }(
            _buildSendParam(amount, to),
            MessagingFee({ nativeFee: msg.value, lzTokenFee: 0 }),
            refundAddress
        );
    }

    /// @dev Reproduces `Options.newOptions().addExecutorLzReceiveOption(executorGas, 0).toHex()`
    ///      from the layerzerolabs/lz-v2-utilities package. Layout:
    ///      0x0003 (type 3) || 0x01 (worker=executor) || uint16(17) (option length)
    ///      || 0x01 (option type = lzReceive) || uint128(gas).
    function _extraOptions() internal view returns (bytes memory) {
        return abi.encodePacked(uint16(0x0003), uint8(0x01), uint16(17), uint8(0x01), executorGas);
    }

    function _buildSendParam(uint256 amount, address to) internal view returns (SendParam memory) {
        return
            SendParam({
                dstEid: dstEid,
                to: bytes32(uint256(uint160(to))),
                amountLD: amount,
                minAmountLD: amount,
                extraOptions: _extraOptions(),
                composeMsg: "",
                oftCmd: ""
            });
    }
}
