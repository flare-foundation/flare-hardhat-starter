// yarn hardhat run scripts/firelight/withdraw.ts --network coston2

export const FIRELIGHT_VAULT_ADDRESS = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";

export const IFirelightVault = artifacts.require("IFirelightVault");

const WITHDRAW_AMOUNT = 1; // Number of tokens to withdraw

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
    const amount = WITHDRAW_AMOUNT * (10 ** assetDecimals);

    console.log("=== Withdraw (ERC-4626) ===");
    console.log("Sender:", me);
    console.log("Vault:", FIRELIGHT_VAULT_ADDRESS);
    console.log("Asset:", assetAddress, `(${symbol}, decimals=${assetDecimals})`);
    console.log("Withdraw amount:", amount.toString(), `(= ${WITHDRAW_AMOUNT} ${symbol})`);

    // Withdraw creates a withdrawal request (no immediate asset transfer)
    const withdrawTx = await vault.withdraw(amount, me, me, { from: me });
    console.log("Withdraw tx:", withdrawTx.tx);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

