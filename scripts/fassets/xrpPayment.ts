// install xrpl package:
// npm install xrpl
import { Client, Wallet, xrpToDrops, TxResponse, Payment } from "xrpl";

// yarn hardhat run scripts/fassets/xrpPayment.ts

const AGENT_ADDRESS = "r4KgCNzn9ZuNjpf17DEHZnyyiqpuj599Wm"; // Agent underlying chain address
const AMOUNT_XRP = "10.025"; // XRP amount to send
const PAYMENT_REFERENCE =
  "4642505266410001000000000000000000000000000000000000000000f655fb";

async function send20XrpWithReference() {
    const client = new Client("wss://s.altnet.rippletest.net:51233"); // Testnet
    await client.connect();

    // XRP Ledger Testnet seed
    const wallet: Wallet = Wallet.fromSeed("s000000000000000000000000000000"); // Sender wallet seed

    const payment: Payment = {
        TransactionType: "Payment",
        Account: wallet.address,
        Destination: AGENT_ADDRESS,
        Amount: xrpToDrops(AMOUNT_XRP),
        // Payment reference
        Memos: [
            {
                Memo: {
                    MemoData: PAYMENT_REFERENCE
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
