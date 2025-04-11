// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IFdcVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IFdcVerification.sol";
import {IJsonApi} from "@flarenetwork/flare-periphery-contracts/coston2/IJsonApi.sol";

// Structure expected from the FDC proof's decoded data
struct PriceData {
    uint256 price; // Price in USD cents (e.g., $0.025 becomes 2)
}

interface IPriceVerifier {
    event PriceVerified(uint256 price);

    function verifyPrice(IJsonApi.Proof calldata _proof) external;
    function getLatestPrice() external view returns (uint256);
}

contract PriceVerifier is IPriceVerifier {
    uint256 public latestVerifiedPrice;

    /**
     * @notice Verifies a price proof obtained via FDC JSON API attestation.
     * @param _proof The proof data structure containing the attestation and response.
     */
    function verifyPrice(IJsonApi.Proof calldata _proof) external override {
        // 1. FDC Logic: Verify the proof using the appropriate verification contract
        // For JSON API, we use the auxiliary IJsonApiVerification contract.
        require(
            ContractRegistry.auxiliaryGetIJsonApiVerification().verifyJsonApi(_proof),
            "Invalid JSON API proof"
        );

        // 2. Business Logic: Decode the price data and store it
        // The abi_encoded_data within the proof's response body should match the PriceData struct.
        PriceData memory priceData = abi.decode(
            _proof.data.responseBody.abi_encoded_data,
            (PriceData)
        );

        latestVerifiedPrice = priceData.price;

        emit PriceVerified(latestVerifiedPrice);
    }

    /**
     * @notice Retrieves the last successfully verified price.
     * @return The price in USD cents.
     */
    function getLatestPrice() external view override returns (uint256) {
        return latestVerifiedPrice;
    }

    // --- Helper for ABI generation ---
    // This function is not meant to be called directly but helps ensure
    // the ABI includes the PriceData struct definition, which can be useful
    // for off-chain tooling or verification interfaces.
    function abiPriceDataHack(PriceData calldata) external pure {}
} 