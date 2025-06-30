// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;

import "./fdc/IAddressValidityVerification.sol";
import "./fdc/IBalanceDecreasingTransactionVerification.sol";
import "./fdc/IConfirmedBlockHeightExistsVerification.sol";
import "./fdc/IEVMTransactionVerification.sol";
import "./fdc/IPaymentVerification.sol";
import "./fdc/IReferencedPaymentNonexistenceVerification.sol";
import "./fdc/IJsonApiVerification.sol";

/**
 * FdcVerification interface.
 */
interface IFdcVerification is
    IAddressValidityVerification,
    IBalanceDecreasingTransactionVerification,
    IConfirmedBlockHeightExistsVerification,
    IEVMTransactionVerification,
    IPaymentVerification,
    IReferencedPaymentNonexistenceVerification,
    IJsonApiVerification
{}
