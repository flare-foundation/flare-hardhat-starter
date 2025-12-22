import { FIRELIGHT_VAULT_ADDRESS } from "./firelightVault";

// yarn hardhat run scripts/firelight/mint.ts --network coston2

const SHARES_TO_MINT = 1; // Number of shares to mint

// @ts-expect-error - Type definitions issue, but works at runtime
const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
const FirelightVault = artifacts.require("IFirelightVault");

async function main() {

    const [me] = await web3.eth.getAccounts();
    const vault = await FirelightVault.at(FIRELIGHT_VAULT_ADDRESS);
    
    // Get asset address from vault
    const assetAddress = await vault.asset();
    const assetToken = await IERC20.at(assetAddress);
  
    const symbol = await assetToken.symbol();
    const assetDecimals = await assetToken.decimals();
    const sharesToMint = SHARES_TO_MINT * (10 ** assetDecimals);

    console.log("=== Mint vault shares (ERC-4626) ===");
    console.log("Sender:", me);
    console.log("Vault:", FIRELIGHT_VAULT_ADDRESS);
    console.log("Asset:", assetAddress, `(${symbol}, decimals=${assetDecimals})`);
    console.log("Shares to mint:", sharesToMint.toString(), `(= ${SHARES_TO_MINT} share${SHARES_TO_MINT > 1 ? 's' : ''})`);

    // Use previewMint to calculate how much assets we need to approve
    const assetsNeeded = await vault.previewMint(sharesToMint);
    console.log("Assets needed (from previewMint):", assetsNeeded.toString());

    // Approve + mint vault shares
    const approveTx = await assetToken.approve(vault.address, assetsNeeded, { from: me });
    console.log("Approve tx:", approveTx.tx);

    const mintTx = await vault.mint(sharesToMint, me, { from: me });
    console.log("Mint tx:", mintTx.tx);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

