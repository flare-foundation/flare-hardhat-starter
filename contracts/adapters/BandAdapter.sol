// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

interface IStdReference {
    struct ReferenceData {
        uint256 rate;
        uint256 lastUpdatedBase;
        uint256 lastUpdatedQuote;
    }
    function getReferenceData(
        string memory _base,
        string memory _quote
    ) external view returns (ReferenceData memory);
    function getReferenceDataBulk(
        string[] memory _bases,
        string[] memory _quotes
    ) external view returns (ReferenceData[] memory);
}

library FtsoBandAdapterLibrary {
    uint8 private constant BAND_DECIMALS = 18;
    bytes1 private constant FTSO_CRYPTO_CATEGORY = bytes1(0x01);

    function getReferenceData(
        string memory _base,
        string memory _quote
    ) internal returns (IStdReference.ReferenceData memory) {
        FtsoV2Interface ftsoV2 = ContractRegistry.getFtsoV2();
        bytes21 ftsoFeedId = _constructFeedId(_base, _quote);
        (uint256 rawValue, int8 ftsoDecimals, uint64 ts) = ftsoV2.getFeedById(
            ftsoFeedId
        );
        require(ts != 0, "FTSO: Feed not available");
        uint256 scaledRate = _scaleValue(
            rawValue,
            ftsoDecimals,
            int8(BAND_DECIMALS)
        );
        return
            IStdReference.ReferenceData({
                rate: scaledRate,
                lastUpdatedBase: ts,
                lastUpdatedQuote: ts
            });
    }

    function getReferenceDataBulk(
        string[] memory _bases,
        string[] memory _quotes
    ) internal returns (IStdReference.ReferenceData[] memory) {
        require(_bases.length == _quotes.length, "Mismatched input lengths");
        IStdReference.ReferenceData[]
            memory results = new IStdReference.ReferenceData[](_bases.length);
        for (uint i = 0; i < _bases.length; i++) {
            results[i] = getReferenceData(_bases[i], _quotes[i]);
        }
        return results;
    }

    /**
     * @dev Constructs a bytes21 FTSO feed ID from base/quote strings.
     * This version correctly pads the value to the right to match FTSO's format.
     */
    // *** FIX IS HERE: Replaced the buggy assembly with a safe and correct implementation. ***
    function _constructFeedId(
        string memory _base,
        string memory _quote
    ) private pure returns (bytes21) {
        bytes memory feedName = bytes.concat(bytes(_base), "/", bytes(_quote));
        require(feedName.length <= 20, "Feed name is too long");

        bytes memory buffer = new bytes(21);
        buffer[0] = FTSO_CRYPTO_CATEGORY;

        for (uint i = 0; i < feedName.length; i++) {
            buffer[i + 1] = feedName[i];
        }

        bytes21 feedId;
        assembly {
            // Load the 21 bytes from the buffer into the feedId variable.
            // mload reads 32 bytes, but Solidity correctly truncates it to bytes21.
            feedId := mload(add(buffer, 0x20))
        }
        return feedId;
    }

    function _scaleValue(
        uint256 value,
        int8 fromDecimals,
        int8 toDecimals
    ) private pure returns (uint256) {
        if (fromDecimals == toDecimals) return value;
        if (fromDecimals < toDecimals) {
            return value * (10 ** uint256(uint8(toDecimals - fromDecimals)));
        } else {
            return value / (10 ** uint256(uint8(fromDecimals - toDecimals)));
        }
    }
}
