// install xrpl package:
// npm install xrpl
import { Client, Wallet, xrpToDrops, TxResponse, Payment } from "xrpl";

// yarn hardhat run scripts/fassets/xrpPayment.ts

async function send20XrpWithReference() {
    const client = new Client("wss://s.altnet.rippletest.net:51233"); // Testnet
    await client.connect();

    // XRP Ledger Testnet seed
    const wallet: Wallet = Wallet.fromSeed("s000000000000000000000000000000"); // Sender wallet seed

    const payment: Payment = {
        TransactionType: "Payment",
        Account: wallet.address,
        Destination: "r47WNtv2zvezDhy3qqxpPt8QFxfDVDbYch",
        Amount: xrpToDrops("10.025"),
        // Payment reference
        Memos: [
            {
                Memo: {
                    MemoData: "46425052664100010000000000000000000000000000000000000000005d154f"
                }
            }
        ]
    };

    console.log(payment);

    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result: TxResponse = await client.submitAndWait(signed.tx_blob);

    console.log("Transaction hash:", signed.hash);
    console.log("Explorer: https://testnet.xrpl.org/transactions/" + signed.hash);
    console.log("Result:", result);

    await client.disconnect();
}

send20XrpWithReference().catch(console.error);
