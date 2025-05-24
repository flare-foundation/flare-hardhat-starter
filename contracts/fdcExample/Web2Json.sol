// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

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

interface IStarWarsCharacterListV2 {
    function addCharacter(IWeb2Json.Proof calldata data) external;
    function getAllCharacters()
        external
        view
        returns (StarWarsCharacter[] memory);
}

contract StarWarsCharacterListV2 {
    mapping(uint256 => StarWarsCharacter) public characters;
    uint256[] public characterIds;

    function addCharacter(IWeb2Json.Proof calldata data) public {
        require(isJsonApiProofValid(data), "Invalid proof");

        DataTransportObject memory dto = abi.decode(
            data.data.responseBody.abiEncodedData,
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

    function abiSignatureHack(DataTransportObject calldata dto) public pure {}

    function isJsonApiProofValid(
        IWeb2Json.Proof calldata _proof
    ) private view returns (bool) {
        // Inline the check for now until we have an official contract deployed
        return ContractRegistry.getFdcVerification().verifyJsonApi(_proof);
    }
}
