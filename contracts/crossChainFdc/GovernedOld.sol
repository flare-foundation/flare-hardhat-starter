// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;

import {GovernedBaseOld} from "./GovernedBaseOld.sol";

/**
 * Defines behaviors for governed contracts that must have a governor set at construction-time.
 */
contract GovernedOld is GovernedBaseOld {
    /**
     * @param _governance Governance contract. Must not be zero.
     */
    constructor(address _governance) GovernedBaseOld(_governance) {
        require(_governance != address(0), "_governance zero");
    }
}
