// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAssetManager} from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";
import {AssetManagerSettings} from "@flarenetwork/flare-periphery-contracts/coston2/data/AssetManagerSettings.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FAssetsRedeem {
    IAssetManager public immutable assetManager;
    IERC20 public immutable underlyingToken;

    address public immutable fAssetToken;

    constructor(address _assetManager, address _fAssetToken) {
        assetManager = IAssetManager(_assetManager);
        fAssetToken = _fAssetToken;
    }

    function approveFAssets(uint256 _amount) public returns (bool) {
        return IERC20(fAssetToken).approve(address(this), _amount);
    }

    function redeem(
        uint256 _lots,
        string memory _redeemerUnderlyingAddressString
    ) public returns (uint256) {
        // Calculate the amount of FXRP needed for redemption
        AssetManagerSettings.Data memory settings = assetManager.getSettings();
        uint256 amountToRedeem = settings.lotSizeAMG * _lots;

        // Transfer FXRP from caller to AssetManager
        IERC20(fAssetToken).transferFrom(
            msg.sender,
            address(this),
            amountToRedeem
        );

        uint256 redeemedAmountUBA = assetManager.redeem(
            _lots,
            _redeemerUnderlyingAddressString,
            payable(address(0))
        );

        return redeemedAmountUBA;
    }

    function getSettings()
        public
        view
        returns (uint256 lotSizeAMG, uint256 assetDecimals)
    {
        AssetManagerSettings.Data memory settings = assetManager.getSettings();
        lotSizeAMG = settings.lotSizeAMG;
        assetDecimals = settings.assetDecimals;

        return (lotSizeAMG, assetDecimals);
    }
}
