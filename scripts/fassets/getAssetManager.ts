// yarn hardhat run scripts/fassets/getAssetManager.ts --network coston2

async function main() {
  const AssetManagerRegistry = artifacts.require("AssetManagerRegistry");

  const assetManagerRegistry = await AssetManagerRegistry.new();
  console.log("FAssetsSettings deployed to:", assetManagerRegistry.address);

  const fxrpAssetManager = await assetManagerRegistry.getFxrpAssetManager();
  console.log("FXRP Asset Manager address:", fxrpAssetManager);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});