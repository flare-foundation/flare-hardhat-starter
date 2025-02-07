// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.9;

/**
 * @custom:name IJsonApi
 * @custom:supported WEB2
 * @author Flare
 * @notice An attestation request that fetches data from the given url and then edits the information with a
 * jq transformation.
 * @custom:verification  Data is fetched from an url `url`. The received data is then processed with jq as
 * the `postprocessJq` states. The structure of the final json is written in the `abi_signature`.
 *
 * The response contains an abi encoding of the final data.
 * @custom:lut `0xffffffffffffffff`
 * @custom:lut-limit `0xffffffffffffffff`
 */
interface IJsonApi {
    /**
     * @notice Toplevel request
     * @param attestationType ID of the attestation type.
     * @param sourceId ID of the data source.
     * @param messageIntegrityCode `MessageIntegrityCode` that is derived from the expected response.
     * @param requestBody Data defining the request. Type (struct) and interpretation is determined
     * by the `attestationType`.
     */
    struct Request {
        bytes32 attestationType;
        bytes32 sourceId;
        bytes32 messageIntegrityCode;
        RequestBody requestBody;
    }

    /**
     * @notice Toplevel response
     * @param attestationType Extracted from the request.
     * @param sourceId Extracted from the request.
     * @param votingRound The ID of the State Connector round in which the request was considered.
     * @param lowestUsedTimestamp The lowest timestamp used to generate the response.
     * @param requestBody Extracted from the request.
     * @param responseBody Data defining the response. The verification rules for the construction
     * of the response body and the type are defined per specific `attestationType`.
     */
    struct Response {
        bytes32 attestationType;
        bytes32 sourceId;
        uint64 votingRound;
        uint64 lowestUsedTimestamp;
        RequestBody requestBody;
        ResponseBody responseBody;
    }

    /**
     * @notice Toplevel proof
     * @param merkleProof Merkle proof corresponding to the attestation response.
     * @param data Attestation response.
     */
    struct Proof {
        bytes32[] merkleProof;
        Response data;
    }

    /**
     * @notice Request body for Payment attestation type
     * @param url URL of the data source
     * @param postprocessJq jq filter to postprocess the data
     * @param abi_signature ABI signature of the data
     */
    struct RequestBody {
        string url;
        string postprocessJq;
        string abi_signature;
    }

    /**
     * @notice Response body for Payment attestation type
     * @param abi_encoded_data ABI encoded data
     */
    struct ResponseBody {
        bytes abi_encoded_data;
    }
}
