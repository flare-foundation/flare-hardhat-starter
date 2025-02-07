// SPDX-License-Identifier: MIT
  pragma solidity 0.8.20;
  
  import "../../../interfaces/types/IJsonApi.sol";
  
  
  interface IJsonApiVerification {
     function verifyJsonApi(
        IJsonApi.Proof calldata _proof
     ) external view returns (bool _proved);
  }
     