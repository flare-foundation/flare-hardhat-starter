import { FIRELIGHT_VAULT_ADDRESS, IFirelightVault } from "./firelightVault";

// yarn hardhat run scripts/firelight/deposit.ts --network coston2

const DEPOSIT_AMOUNT = 1; // Number of tokens to deposit

// @ts-expect-error - Type definitions issue, but works at runtime
const IERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");

async function main() {

    const [me] = await web3.eth.getAccounts();
    const vault = await IFirelightVault.at(FIRELIGHT_VAULT_ADDRESS);
    
    // Get asset address from vault
    const assetAddress = await vault.asset();
    const assetToken = await IERC20.at(assetAddress);

    const symbol = await assetToken.symbol();
    const assetDecimals = await assetToken.decimals();
    const amount = DEPOSIT_AMOUNT * (10 ** assetDecimals);

    console.log("=== Deposit (ERC-4626) ===");
    console.log("Sender:", me);
    console.log("Vault:", FIRELIGHT_VAULT_ADDRESS);
    console.log("Asset:", assetAddress, `(${symbol}, decimals=${assetDecimals})`);
    console.log("Deposit amount:", amount.toString(), `(= ${DEPOSIT_AMOUNT} ${symbol})`);

    // Approve + deposit.
    const approveTx = await assetToken.approve(vault.address, amount, { from: me });
    console.log("Approve tx:", approveTx.tx);

    const depositTx = await vault.deposit(amount, me, { from: me });
    console.log("Deposit tx:", depositTx.tx);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

