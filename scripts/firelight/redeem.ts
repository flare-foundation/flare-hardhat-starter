import { FIRELIGHT_VAULT_ADDRESS, IFirelightVault } from "./firelightVault";

// yarn hardhat run scripts/firelight/redeem.ts --network coston2

const SHARES_TO_REDEEM = 1; // Number of shares to redeem

async function main() {
    const [me] = await web3.eth.getAccounts();
    const vault = await IFirelightVault.at(FIRELIGHT_VAULT_ADDRESS);
    
    // Get asset address from vault
    const assetAddress = await vault.asset();
    
    // @ts-expect-error - Type definitions issue, but works at runtime
    const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
    const assetToken = await IERC20.at(assetAddress);

    const symbol = await assetToken.symbol();
    const assetDecimals = await assetToken.decimals();
    const sharesToRedeem = SHARES_TO_REDEEM * (10 ** assetDecimals);

    console.log("=== Redeem (ERC-4626) ===");
    console.log("Sender:", me);
    console.log("Vault:", FIRELIGHT_VAULT_ADDRESS);
    console.log("Asset:", assetAddress, `(${symbol}, decimals=${assetDecimals})`);
    console.log("Shares to redeem:", sharesToRedeem.toString(), `(= ${SHARES_TO_REDEEM} share${SHARES_TO_REDEEM > 1 ? 's' : ''})`);

    // Redeem creates a withdrawal request (no immediate asset transfer)
    const redeemTx = await vault.redeem(sharesToRedeem, me, me, { from: me });
    console.log("Redeem tx:", redeemTx.tx);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

