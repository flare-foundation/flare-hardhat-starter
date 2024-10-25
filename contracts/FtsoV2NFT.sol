// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.20;

// import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
// import {FTSOFeedIdConverter} from "@flarenetwork/flare-periphery-contracts/coston/FTSOFeedIdConverter.sol";
// import {FlareContractsRegistryLibrary} from "@flarenetwork/flare-periphery-contracts/coston/ContractRegistry.sol";
// import {IRelay} from "@flarenetwork/flare-periphery-contracts/coston/IRelay.sol";
// import {IFTSOFeedVerifier} from "@flarenetwork/flare-periphery-contracts/coston/IFTSOFeedVerifier.sol";

// struct NFTInfo {
//     string name;
//     string FTSOsymbol;
//     int256 basePrice;
//     string uri;
// }

// contract FTSOV2NFT is ERC721URIStorage {
//     uint256 public currentIndex = 0;
//     address public owner;
//     uint256 public constant PRICE_BASE = 10;
//     uint256 public MAX_HISTORICAL_VOTING_EPOCHS = 4;

//     NFTInfo[] public availableOptions;
//     mapping(string => uint256) public optionIndex;

//     constructor(string memory name, string memory symbol) ERC721(name, symbol) {
//         owner = msg.sender;

//         availableOptions.push(
//             NFTInfo({
//                 name: "BTC",
//                 FTSOsymbol: "BTC/USD",
//                 basePrice: -6,
//                 uri: "https://gateway.pinata.cloud/ipfs/QmSxVviWjkMJ3x3GAqd6D8F1xEJccezMwUyApGHuZcQm4S"
//             })
//         );
//         availableOptions.push(
//             NFTInfo({
//                 name: "DOGE",
//                 FTSOsymbol: "DOGE/USD",
//                 basePrice: 1,
//                 uri: "https://gateway.pinata.cloud/ipfs/QmSxVviWjkMJ3x3GAqd6D8F1xEJccezMwUyApGHuZcQm4S"
//             })
//         );
//         availableOptions.push(
//             NFTInfo({
//                 name: "XRP",
//                 FTSOsymbol: "XRP/USD",
//                 basePrice: 2,
//                 uri: "https://gateway.pinata.cloud/ipfs/QmSxVviWjkMJ3x3GAqd6D8F1xEJccezMwUyApGHuZcQm4S"
//             })
//         );

//         for (uint256 i = 0; i < availableOptions.length; i++) {
//             optionIndex[availableOptions[i].name] = i;
//         }
//     }

//     function getRelay() public view returns (IRelay) {
//         return FlareContractsRegistryLibrary.getRelay();
//     }

//     function getAvailableOptions() public view returns (NFTInfo[] memory) {
//         return availableOptions;
//     }

//     function getPriceInFlare(
//         string memory quoteCurrency,
//         IFTSOFeedVerifier.FeedWithProof calldata quoteCurrencyPrice,
//         IFTSOFeedVerifier.FeedWithProof calldata baseCurrencyPrice
//     ) public view returns (uint256) {
//         if (quoteCurrencyPrice.proof.length >= 1) {
//             require(
//                 checkCorrectness(quoteCurrencyPrice),
//                 "Invalid quote currency price"
//             );
//         }
//         if (baseCurrencyPrice.proof.length >= 1) {
//             require(
//                 checkCorrectness(baseCurrencyPrice),
//                 "Invalid base currency price"
//             );
//         }
//         // Check that the base currency is FLR
//         require(
//             baseCurrencyPrice.body.id ==
//                 FTSOFeedIdConverter.getCryptoFeedId("FLR/USD"),
//             "Invalid base currency"
//         );
//         // Check that the quote currency is the same as provided proof
//         require(
//             FTSOFeedIdConverter.getCryptoFeedId(quoteCurrency) ==
//                 quoteCurrencyPrice.body.id,
//             "Invalid price feed"
//         );
//         require(
//             quoteCurrencyPrice.body.votingRoundId ==
//                 baseCurrencyPrice.body.votingRoundId,
//             "Voting round mismatch"
//         );

//         uint256 currentVotingRoundId = getCurrentVotingRoundId();

//         require(
//             quoteCurrencyPrice.body.votingRoundId +
//                 MAX_HISTORICAL_VOTING_EPOCHS >=
//                 currentVotingRoundId,
//             "Voting round too old"
//         );

//         int8 decimalDifferecne = baseCurrencyPrice.body.decimals -
//             quoteCurrencyPrice.body.decimals;

//         NFTInfo memory nftInfo = availableOptions[optionIndex[quoteCurrency]];

//         int256 nftPrice = nftInfo.basePrice;
//         uint256 priceInFlare = 1 ether;
//         if (nftPrice > 0) {
//             priceInFlare = priceInFlare * (PRICE_BASE ** uint256(nftPrice));
//         }
//         priceInFlare =
//             (priceInFlare * uint32(quoteCurrencyPrice.body.value)) /
//             uint32(baseCurrencyPrice.body.value);

//         if (decimalDifferecne > 0) {
//             priceInFlare = priceInFlare * (10 ** uint8(decimalDifferecne));
//         } else if (decimalDifferecne < 0) {
//             priceInFlare = priceInFlare / (10 ** uint8(-decimalDifferecne));
//         }
//         if (nftPrice < 0) {
//             priceInFlare = priceInFlare / (PRICE_BASE ** uint256(-nftPrice));
//         }
//         return priceInFlare;
//     }

//     function buyNFT(
//         string memory quoteCurrency,
//         IFTSOFeedVerifier.FeedWithProof calldata quoteCurrencyPrice,
//         IFTSOFeedVerifier.FeedWithProof calldata baseCurrencyPrice
//     ) public payable {
//         uint256 price = getPriceInFlare(
//             quoteCurrency,
//             quoteCurrencyPrice,
//             baseCurrencyPrice
//         );
//         require(msg.value >= price, "Insufficient funds");
//         _safeMint(msg.sender, currentIndex);
//         NFTInfo memory nftInfo = availableOptions[optionIndex[quoteCurrency]];
//         _setTokenURI(currentIndex, nftInfo.uri);
//         ++currentIndex;
//     }

//     function getCurrentVotingRoundId() public view returns (uint256) {
//         return getRelay().getVotingRoundId(block.timestamp);
//     }

//     function getSafeVotingRoundId() public view returns (uint256) {
//         uint256 currentVotingEpoch = getCurrentVotingRoundId();
//         IRelay relay = getRelay();
//         for (uint256 i = 0; i < MAX_HISTORICAL_VOTING_EPOCHS; i++) {
//             bytes32 root = relay.getConfirmedMerkleRoot(
//                 FlareContractsRegistryLibrary
//                     .auxiliaryGetIFTSOFeedVerifier()
//                     .get_ftso_protocol_feed_id(),
//                 currentVotingEpoch - i
//             );
//             if (root != 0) {
//                 return currentVotingEpoch - i;
//             }
//         }
//         revert("No safe voting epoch found");
//     }

//     function checkCorrectness(
//         IFTSOFeedVerifier.FeedWithProof calldata _feed_data
//     ) public view returns (bool) {
//         return
//             FlareContractsRegistryLibrary
//                 .auxiliaryGetIFTSOFeedVerifier()
//                 .verifyPrice(_feed_data);
//     }

//     function pullFunds() public {
//         require(msg.sender == owner, "Only owner can pull funds");
//         payable(msg.sender).transfer(address(this).balance);
//     }
// }
