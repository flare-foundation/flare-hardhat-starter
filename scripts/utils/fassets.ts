import { getAssetManagerFXRP } from "./getters";

/**
 * Gets the FXRP token address
 */
export async function getFXRPTokenAddress() {
    const assetManager = await getAssetManagerFXRP();
    const fasset = await assetManager.fAsset();

    return fasset;
}

/**
 * Calculates the amount to send based on lots.
 * 1 lot = 10 FXRP (10_000_000 in 6 decimals)
 */
export function calculateAmountToSend(lots: bigint) {
    const lotSize = BigInt(10_000_000);
    return lotSize * lots;
}
