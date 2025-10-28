import hre from "hardhat";

const IFlareContractRegistry = artifacts.require("IFlareContractRegistry");
const IPriceSubmitter = artifacts.require("IPriceSubmitter");
const IGovernanceSettings = artifacts.require("IGovernanceSettings");
const IFtsoRewardManager = artifacts.require("IFtsoRewardManager");
const IFtsoRegistry = artifacts.require("IFtsoRegistry");
const IVoterWhitelister = artifacts.require("IVoterWhitelister");
const IFtsoManager = artifacts.require("IFtsoManager");
const IWNat = artifacts.require("IWNat");
const IGovernanceVotePower = artifacts.require("IGovernanceVotePower");
const IClaimSetupManager = artifacts.require("IClaimSetupManager");
const IFlareAssetRegistry = artifacts.require("IFlareAssetRegistry");
const ISubmission = artifacts.require("ISubmission");
const IEntityManager = artifacts.require("IEntityManager");
const IVoterRegistry = artifacts.require("IVoterRegistry");
const IFlareSystemsCalculator = artifacts.require("IFlareSystemsCalculator");
const IFlareSystemsManager = artifacts.require("IFlareSystemsManager");
const IRewardManager = artifacts.require("IRewardManager");
const IRelay = artifacts.require("IRelay");
const IWNatDelegationFee = artifacts.require("IWNatDelegationFee");
const IFtsoInflationConfigurations = artifacts.require("IFtsoInflationConfigurations");
const IFtsoRewardOffersManager = artifacts.require("IFtsoRewardOffersManager");
const IFtsoFeedDecimals = artifacts.require("IFtsoFeedDecimals");
const IFtsoFeedPublisher = artifacts.require("IFtsoFeedPublisher");
const IFtsoFeedIdConverter = artifacts.require("IFtsoFeedIdConverter");
const IFastUpdateIncentiveManager = artifacts.require("IFastUpdateIncentiveManager");
const IFastUpdater = artifacts.require("IFastUpdater");
const IFastUpdatesConfiguration = artifacts.require("IFastUpdatesConfiguration");
const IFeeCalculator = artifacts.require("IFeeCalculator");
const FtsoV2Interface = artifacts.require("FtsoV2Interface");
const TestFtsoV2Interface = artifacts.require("TestFtsoV2Interface");
const ProtocolsV2Interface = artifacts.require("ProtocolsV2Interface");
const RandomNumberV2Interface = artifacts.require("RandomNumberV2Interface");
const RewardsV2Interface = artifacts.require("RewardsV2Interface");
const IFdcVerification = artifacts.require("IFdcVerification");
const IFdcHub = artifacts.require("IFdcHub");
const IFdcRequestFeeConfigurations = artifacts.require("IFdcRequestFeeConfigurations");
const IAssetManagerController = artifacts.require("IAssetManagerController");
const IAssetManager = artifacts.require("IAssetManager");
const IJsonApiVerification = artifacts.require("IJsonApiVerification");

const FLARE_CONTRACT_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

export async function getFlareContractRegistry() {
    return await IFlareContractRegistry.at(FLARE_CONTRACT_REGISTRY_ADDRESS);
}

export async function getContractAddressByName(name: string) {
    const flareContractRegistry = await getFlareContractRegistry();
    return await flareContractRegistry.getContractAddressByName(name);
}

export async function getPriceSubmitter() {
    const address: string = await getContractAddressByName("PriceSubmitter");
    return await IPriceSubmitter.at(address);
}

export async function getGovernanceSettings() {
    const address: string = await getContractAddressByName("GovernanceSettings");
    return await IGovernanceSettings.at(address);
}

export async function getFtsoRewardManager() {
    const address: string = await getContractAddressByName("FtsoRewardManager");
    return await IFtsoRewardManager.at(address);
}

export async function getFtsoRegistry() {
    const address: string = await getContractAddressByName("FtsoRegistry");
    return await IFtsoRegistry.at(address);
}

export async function getVoterWhitelister() {
    const address: string = await getContractAddressByName("VoterWhitelister");
    return await IVoterWhitelister.at(address);
}

export async function getFtsoManager() {
    const address: string = await getContractAddressByName("FtsoManager");
    return await IFtsoManager.at(address);
}

export async function getWNat() {
    const address: string = await getContractAddressByName("WNat");
    return await IWNat.at(address);
}

export async function getGovernanceVotePower() {
    const address: string = await getContractAddressByName("GovernanceVotePower");
    return await IGovernanceVotePower.at(address);
}

export async function getClaimSetupManager() {
    const address: string = await getContractAddressByName("ClaimSetupManager");
    return await IClaimSetupManager.at(address);
}

export async function getFlareAssetRegistry() {
    const address: string = await getContractAddressByName("FlareAssetRegistry");
    return await IFlareAssetRegistry.at(address);
}

export async function getSubmission() {
    const address: string = await getContractAddressByName("Submission");
    return await ISubmission.at(address);
}

export async function getEntityManager() {
    const address: string = await getContractAddressByName("EntityManager");
    return await IEntityManager.at(address);
}

export async function getVoterRegistry() {
    const address: string = await getContractAddressByName("VoterRegistry");
    return await IVoterRegistry.at(address);
}

export async function getFlareSystemsCalculator() {
    const address: string = await getContractAddressByName("FlareSystemsCalculator");
    return await IFlareSystemsCalculator.at(address);
}

export async function getFlareSystemsManager() {
    const address: string = await getContractAddressByName("FlareSystemsManager");
    return await IFlareSystemsManager.at(address);
}

export async function getRewardManager() {
    const address: string = await getContractAddressByName("RewardManager");
    return await IRewardManager.at(address);
}

export async function getRelay() {
    const address: string = await getContractAddressByName("Relay");
    return await IRelay.at(address);
}

export async function getWNatDelegationFee() {
    const address: string = await getContractAddressByName("WNatDelegationFee");
    return await IWNatDelegationFee.at(address);
}

export async function getFtsoInflationConfigurations() {
    const address: string = await getContractAddressByName("FtsoInflationConfigurations");
    return await IFtsoInflationConfigurations.at(address);
}

export async function getFtsoRewardOffersManager() {
    const address: string = await getContractAddressByName("FtsoRewardOffersManager");
    return await IFtsoRewardOffersManager.at(address);
}

export async function getFtsoFeedDecimals() {
    const address: string = await getContractAddressByName("FtsoFeedDecimals");
    return await IFtsoFeedDecimals.at(address);
}

export async function getFtsoFeedPublisher() {
    const address: string = await getContractAddressByName("FtsoFeedPublisher");
    return await IFtsoFeedPublisher.at(address);
}

export async function getFtsoFeedIdConverter() {
    const address: string = await getContractAddressByName("FtsoFeedIdConverter");
    return await IFtsoFeedIdConverter.at(address);
}

export async function getFastUpdateIncentiveManager() {
    const address: string = await getContractAddressByName("FastUpdateIncentiveManager");
    return await IFastUpdateIncentiveManager.at(address);
}

export async function getFastUpdater() {
    const address: string = await getContractAddressByName("FastUpdater");
    return await IFastUpdater.at(address);
}

export async function getFastUpdatesConfiguration() {
    const address: string = await getContractAddressByName("FastUpdatesConfiguration");
    return await IFastUpdatesConfiguration.at(address);
}

export async function getFeeCalculator() {
    const address: string = await getContractAddressByName("FeeCalculator");
    return await IFeeCalculator.at(address);
}

export async function getFtsoV2() {
    const address: string = await getContractAddressByName("FtsoV2");
    return await FtsoV2Interface.at(address);
}

export async function getTestFtsoV2() {
    const address: string = await getContractAddressByName("TestFtsoV2");
    return await TestFtsoV2Interface.at(address);
}

export async function getProtocolsV2() {
    const address: string = await getContractAddressByName("ProtocolsV2");
    return await ProtocolsV2Interface.at(address);
}

export async function getRandomNumberV2() {
    const address: string = await getContractAddressByName("RandomNumberV2");
    return await RandomNumberV2Interface.at(address);
}

export async function getRewardsV2() {
    const address: string = await getContractAddressByName("RewardsV2");
    return await RewardsV2Interface.at(address);
}

export async function getFdcVerification() {
    const address: string = await getContractAddressByName("FdcVerification");
    return await IFdcVerification.at(address);
}

export async function getFdcHub() {
    const address: string = await getContractAddressByName("FdcHub");
    return await IFdcHub.at(address);
}

export async function getFdcRequestFeeConfigurations() {
    const address: string = await getContractAddressByName("FdcRequestFeeConfigurations");
    return await IFdcRequestFeeConfigurations.at(address);
}

export async function getAssetManagerController() {
    const address: string = await getContractAddressByName("AssetManagerController");
    return await IAssetManagerController.at(address);
}

export async function getAssetManagerFXRP() {
    assert(
        ["coston2", "coston", "songbird", "flare"].includes(hre.network.name),
        `Contract not deployed on ${hre.network.name}`
    );
    const address: string = await getContractAddressByName("AssetManagerFXRP");
    return await IAssetManager.at(address);
}

export async function getJsonApiVerification() {
    assert(
        ["coston2", "coston", "songbird", "flare"].includes(hre.network.name),
        `Contract not deployed on ${hre.network.name}`
    );
    const address: string = await getContractAddressByName("JsonApiVerification");
    return await IJsonApiVerification.at(address);
}
