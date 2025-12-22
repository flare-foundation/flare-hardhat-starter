import { fmtTs } from "../utils/core";

import { FIRELIGHT_VAULT_ADDRESS, IFirelightVault } from "./firelightVault";

// yarn hardhat run scripts/firelight/status.ts --network coston2

async function main() {
    const vault = await IFirelightVault.at(FIRELIGHT_VAULT_ADDRESS);

    const [asset, totalAssets, currentPeriod, currentPeriodEnd, nextPeriodEnd, pcLen] = await Promise.all([
        vault.asset(),
        vault.totalAssets(),
        vault.currentPeriod(),
        vault.currentPeriodEnd(),
        vault.nextPeriodEnd(),
        vault.periodConfigurationsLength(),
    ]);

    console.log("=== FirelightVault status ===");
    console.log("Vault:", FIRELIGHT_VAULT_ADDRESS);
    console.log("Asset:", asset);
    console.log("Total assets (excl. pending withdrawals):", totalAssets.toString());
    console.log("Period configurations:", pcLen.toString());
    console.log("Current period:", currentPeriod.toString());
    console.log("Current period end:", fmtTs(currentPeriodEnd));
    console.log("Next period end:", fmtTs(nextPeriodEnd));

    // Optional: show what the first configured account can claim for a past period.
    const [me] = await web3.eth.getAccounts();
    const currentPeriodBN = web3.utils.toBN(currentPeriod);
    const prevPeriod = currentPeriodBN.isZero() ? currentPeriodBN : currentPeriodBN.subn(1);
    if (prevPeriod.lt(currentPeriodBN)) {
        try {
            const claimable = await vault.withdrawalsOf(prevPeriod, me, { from: me });
            console.log(`WithdrawalsOf(period=${prevPeriod.toString()}, me=${me}):`, claimable.toString());
        } catch (e: any) {
            console.log("withdrawalsOf() call failed:", e?.message ?? e);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
