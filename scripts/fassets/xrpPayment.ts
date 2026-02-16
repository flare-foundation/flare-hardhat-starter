// install xrpl package:
// npm install xrpl
import fs from "fs";
import path from "path";
import { Client, Wallet, xrpToDrops, TxResponse, Payment } from "xrpl";
import { collateralReservationId, paymentAddress, paymentReference, amountXRP } from "./config/mintingConfig";

// yarn hardhat run scripts/fassets/xrpPayment.ts

const { XRPL_SECRET } = process.env;

async function sendXrpWithReference() {
    const client = new Client("wss://s.altnet.rippletest.net:51233"); // Testnet
    await client.connect();

    // Use provided XRPL secret or fall back to generating a funded wallet
    let wallet: Wallet;
    if (XRPL_SECRET) {
        wallet = Wallet.fromSeed(XRPL_SECRET);
    } else {
        console.log("No XRPL_SECRET provided, funding a new testnet wallet...");
        const fundResult = await client.fundWallet();
        wallet = fundResult.wallet;
        console.log("Funded wallet address:", wallet.address);
    }

    console.log("Sending XRP payment:");
    console.log("  To:", paymentAddress);
    console.log("  Amount:", amountXRP, "XRP");
    console.log("  Reference:", paymentReference);
    console.log("  Collateral Reservation ID:", collateralReservationId);

    const payment: Payment = {
        TransactionType: "Payment",
        Account: wallet.address,
        Destination: paymentAddress,
        Amount: xrpToDrops(amountXRP),
        // Payment reference
        Memos: [
            {
                Memo: {
                    MemoData: paymentReference.startsWith("0x") ? paymentReference.slice(2) : paymentReference,
                },
            },
        ],
    };

    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result: TxResponse = await client.submitAndWait(signed.tx_blob);

    console.log("Transaction hash:", signed.hash);
    console.log("Explorer: https://testnet.xrpl.org/transactions/" + signed.hash);
    console.log("Result:", result.result.meta);

    // Update the minting config with the transaction hash
    const configPath = path.join(__dirname, "config", "mintingConfig.ts");
    let config = fs.readFileSync(configPath, "utf-8");
    config = config.replace(
        /export const xrpTransactionHash = ".*";/,
        `export const xrpTransactionHash = "${signed.hash}";`
    );
    fs.writeFileSync(configPath, config);
    console.log(`Updated minting config with transaction hash: ${signed.hash}`);

    await client.disconnect();
}

sendXrpWithReference().catch(console.error);
