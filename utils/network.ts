import * as dotenv from "dotenv";
import hre from "hardhat";
import {
  Contract
} from "ethers";
import {
  flare,
  songbird,
  coston2,
  coston,
  FlareContractRegistryAddress
} from "@flarenetwork/flare-periphery-contract-artifacts";

dotenv.config();

// Helper type for network namespaces
export type FlareNetworkNamespace =
  | typeof flare
  | typeof songbird
  | typeof coston2
  | typeof coston;

// Define a mapping for network namespaces
const networkNamespaces: Record<string, FlareNetworkNamespace> = {
  flare,
  songbird,
  coston2,
  coston,
};

/**
 * Gets the Flare Network namespace object based on the current Hardhat network.
 * @returns The FlareNetworkNamespace object for the current network.
 * @throws Error if the network is unsupported.
 */
export async function getCurrentNetworkNamespace(): Promise<FlareNetworkNamespace> {
  const networkName = hre.network.name;
  const namespace = networkNamespaces[networkName];
  if (!namespace) {
    throw new Error(
      `Unsupported network: ${networkName}. Must be one of: ${Object.keys(
        networkNamespaces
      ).join(", ")}`
    );
  }
  return namespace;
}
// --- End Added Namespace Logic ---


// Network configuration mapping using environment variables
const networkUrls: Record<string, string | undefined> = {
  flare: process.env.FLARE_DA_LAYER_URL,
  songbird: process.env.SONGBIRD_DA_LAYER_URL,
  coston: process.env.COSTON_DA_LAYER_URL,
  coston2: process.env.COSTON2_DA_LAYER_URL,
};

/**
 * Retrieves the Data Availability (DA) Layer URL for the specified network.
 * Reads the URL from the corresponding environment variable.
 *
 * @param networkName The name of the network (e.g., 'flare', 'coston2').
 * @returns The DA Layer URL for the network.
 * @throws Error if the network is unsupported or the URL environment variable is not set or empty.
 */
export function getDALayerUrl(networkName: string): string {
  const url = networkUrls[networkName];

  if (url === undefined) {
    // Check if the network name is valid but the env var is missing
    if (networkName in networkUrls) {
         throw new Error(
            `DA Layer URL environment variable for network '${networkName}' is not set. Please check your .env file.`
         );
    } else {
        // Network name is not in our list
        throw new Error(
            `Unsupported network: ${networkName}. Must be one of: ${Object.keys(networkUrls).join(", ")}`
        );
    }
  }
   if (!url) {
     // Handles cases where the env var might be set but is an empty string
     throw new Error(
       `DA Layer URL for network '${networkName}' is configured but empty. Please check your .env file.`
     );
   }

  return url;
}

/**
 * Initializes the FtsoV2 contract instance for the current network.
 * @param currentNetworkNamespace The namespace object for the current network.
 * @returns A promise resolving to the FtsoV2 contract instance.
 */
export async function initializeFtsoV2Contract(
  currentNetworkNamespace: FlareNetworkNamespace
): Promise<Contract | any> { 
  const provider = hre.ethers.provider;

  const iFlareContractRegistryAddress = FlareContractRegistryAddress;

  const iFlareContractRegistryArtifact =
    currentNetworkNamespace.interfaceAbis.IFlareContractRegistry;

  const flareRegistry = new hre.ethers.Contract(
    iFlareContractRegistryAddress,
    iFlareContractRegistryArtifact,
    provider
  );

  const ftsoV2Address = await flareRegistry.getContractAddressByName("FtsoV2");

  const ftsoV2Artifact = currentNetworkNamespace.interfaceAbis.FtsoV2Interface;

  return new hre.ethers.Contract(ftsoV2Address, ftsoV2Artifact, provider);
}