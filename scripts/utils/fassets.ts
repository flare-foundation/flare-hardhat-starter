import { getAssetManagerFXRP } from "./getters";

/**
 * Gets the FXRP token address
 */
export async function getFXRPTokenAddress() {
  const assetManager = await getAssetManagerFXRP();
  const fasset = await assetManager.fAsset();

  return fasset;
}