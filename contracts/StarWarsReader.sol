// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";

// Dummy import to get artifacts for IFDCHub
import {IFdcHub} from "@flarenetwork/flare-periphery-contracts/coston/IFdcHub.sol";
import {IFdcRequestFeeConfigurations} from "@flarenetwork/flare-periphery-contracts/coston/IFdcRequestFeeConfigurations.sol";

import {IJsonApiVerification} from "@flarenetwork/flare-periphery-contracts/coston/IJsonApiVerification.sol";
import {IJsonApi} from "@flarenetwork/flare-periphery-contracts/coston/IJsonApi.sol";

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

struct StarWarsCharacter {
    string name;
    uint256 numberOfMovies;
    uint256 apiUid;
    uint256 bmi;
}

struct DataTransportObject {
    string name;
    uint256 height;
    uint256 mass;
    uint256 numberOfMovies;
    uint256 apiUid;
}

contract StarWarsCharacterList {
    mapping(uint256 => StarWarsCharacter) public characters;
    uint256[] public characterIds;

    function isJsonApiProofValid(
        IJsonApi.Proof calldata _proof
    ) public view returns (bool) {
        // Inline the check for now until we have an official contract deployed
        return
            ContractRegistry.auxiliaryGetIJsonApiVerification().verifyJsonApi(
                _proof
            );
    }

    function addCharacter(IJsonApi.Proof calldata data) public {
        require(isJsonApiProofValid(data), "Invalid proof");

        DataTransportObject memory dto = abi.decode(
            data.data.responseBody.abi_encoded_data,
            (DataTransportObject)
        );

        require(characters[dto.apiUid].apiUid == 0, "Character already exists");

        StarWarsCharacter memory character = StarWarsCharacter({
            name: dto.name,
            numberOfMovies: dto.numberOfMovies,
            apiUid: dto.apiUid,
            bmi: (dto.mass * 100 * 100) / (dto.height * dto.height)
        });

        characters[dto.apiUid] = character;
        characterIds.push(dto.apiUid);
    }

    function getAllCharacters()
        public
        view
        returns (StarWarsCharacter[] memory)
    {
        StarWarsCharacter[] memory result = new StarWarsCharacter[](
            characterIds.length
        );
        for (uint256 i = 0; i < characterIds.length; i++) {
            result[i] = characters[characterIds[i]];
        }
        return result;
    }

    function getFdcHub() external view returns (IFdcHub) {
        return ContractRegistry.getFdcHub();
    }

    function getFdcRequestFeeConfigurations()
        external
        view
        returns (IFdcRequestFeeConfigurations)
    {
        return ContractRegistry.getFdcRequestFeeConfigurations();
    }
}
