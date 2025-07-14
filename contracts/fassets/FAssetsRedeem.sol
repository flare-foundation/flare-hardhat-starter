// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import {AssetManagerSettings} from "@flarenetwork/flare-periphery-contracts/coston2/data/AssetManagerSettings.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FAssetsRedeem {
    // IAssetManager public immutable assetManager;
    // IERC20 public immutable underlyingToken;

    // address public immutable fAssetToken;

    function approveFAssets(uint256 _amount) public returns (bool) {
        IERC20 fAssetToken = IERC20(getFXRPAddress());
        return fAssetToken.approve(address(this), _amount);
    }

    function redeem(
        uint256 _lots,
        string memory _redeemerUnderlyingAddressString
    ) public returns (uint256) {
        // Calculate the amount of FXRP needed for redemption
        IAssetManager assetManager = ContractRegistry
            .auxiliaryGetAssetManagerFXRP();
        AssetManagerSettings.Data memory settings = assetManager.getSettings();
        uint256 amountToRedeem = settings.lotSizeAMG * _lots;

        IERC20 fAssetToken = IERC20(getFXRPAddress());
        // Transfer FXRP from caller to AssetManager
        fAssetToken.transferFrom(msg.sender, address(this), amountToRedeem);

        uint256 redeemedAmountUBA = assetManager.redeem(
            _lots,
            _redeemerUnderlyingAddressString,
            payable(address(0))
        );

        return redeemedAmountUBA;
    }

    function getFXRPAddress() public view returns (address) {
        IAssetManager assetManager = ContractRegistry
            .auxiliaryGetAssetManagerFXRP();
        return address(assetManager.fAsset());
    }

    function getSettings()
        public
        view
        returns (uint256 lotSizeAMG, uint256 assetDecimals)
    {
        IAssetManager assetManager = ContractRegistry
            .auxiliaryGetAssetManagerFXRP();
        AssetManagerSettings.Data memory settings = assetManager.getSettings();
        lotSizeAMG = settings.lotSizeAMG;
        assetDecimals = settings.assetDecimals;

        return (lotSizeAMG, assetDecimals);
    }
}
