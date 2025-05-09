// install xrpl package:
// npm install xrpl
import { Client, Wallet, xrpToDrops, Payment, TxResponse } from "xrpl";

async function send20XrpWithReference() {
  const client = new Client("wss://s.altnet.rippletest.net:51233"); // Testnet
  await client.connect();

  // XRP Ledger Testnet seed
  const wallet: Wallet = Wallet.fromSeed("s000000000000000000000000000000"); // Sender wallet
                                          

  const paymentTx: Payment = {
    TransactionType: "Payment",
    Account: wallet.classicAddress,
    // Agent underlying chain address
    Destination: "r4KgCNzn9ZuNjpf17DEHZnyyiqpuj599Wm",
    // XRP amount to send
    Amount: xrpToDrops("20.05"),
    // Payment reference
    InvoiceID: "4642505266410001000000000000000000000000000000000000000000f655fb", // Reference
  };

  console.log(paymentTx);

  const prepared = await client.autofill(paymentTx);
  const signed = wallet.sign(prepared);
  const result: TxResponse = await client.submitAndWait(signed.tx_blob);

  console.log("Transaction hash:", signed.hash);
  console.log("Explorer: https://testnet.xrpl.org/transactions/" + signed.hash);

  await client.disconnect();
}

send20XrpWithReference().catch(console.error);