// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FdcVerification} from "./FdcVerification.sol";
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

interface IStarWarsCharacterListV3 {
    function addCharacter(IWeb2Json.Proof calldata data) external;
    function getAllCharacters()
        external
        view
        returns (StarWarsCharacter[] memory);
}

contract StarWarsCharacterListV3 {
    mapping(uint256 => StarWarsCharacter) public characters;
    uint256[] public characterIds;

    FdcVerification public fdcVerification;

    constructor(address fdcVerificationAddress) {
        fdcVerification = FdcVerification(fdcVerificationAddress);
    }

    function addCharacter(IWeb2Json.Proof calldata data) public payable {
        bool isJsonApiProofValid = fdcVerification.verifyJsonApi{
            value: msg.value
        }(data);
        require(isJsonApiProofValid, "Invalid proof");

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
}
