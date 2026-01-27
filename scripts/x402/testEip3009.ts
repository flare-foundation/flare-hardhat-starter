import { MockUSDT0Instance } from "../../typechain-types";
import { ethers } from "ethers";

const MockUSDT0 = artifacts.require("MockUSDT0");

// yarn hardhat run scripts/x402/testEip3009.ts --network coston2

const TOKEN_ADDRESS = process.env.X402_TOKEN_ADDRESS || "";

async function main() {
    if (!TOKEN_ADDRESS) {
        console.error("❌ X402_TOKEN_ADDRESS not set in environment");
        process.exit(1);
    }

    const accounts = await web3.eth.getAccounts();
    const signer = accounts[0];
    const recipient = accounts[1] || "0x1234567890123456789012345678901234567890";

    console.log("═".repeat(60));
    console.log("EIP-3009 transferWithAuthorization Test");
    console.log("═".repeat(60));
    console.log(`Signer:    ${signer}`);
    console.log(`Recipient: ${recipient}`);
    console.log(`Token:     ${TOKEN_ADDRESS}`);
    console.log("─".repeat(60));

    // Get token contract
    const token: MockUSDT0Instance = await MockUSDT0.at(TOKEN_ADDRESS);

    // Get token info
    const name = await token.name();
    const _decimals = await token.decimals();
    const domainSeparator = await token.DOMAIN_SEPARATOR();
    const chainId = await web3.eth.getChainId();

    console.log(`\nToken: ${name}`);
    console.log(`Chain ID: ${chainId}`);
    console.log(`Domain Separator: ${domainSeparator}`);

    // Check initial balance
    const initialBalance = await token.balanceOf(signer);
    console.log(`\nInitial Balance: ${web3.utils.fromWei(initialBalance.toString(), "mwei")} USDT0`);

    // If no balance, mint some tokens
    if (initialBalance.toString() === "0") {
        console.log("\n🪙 Minting test tokens...");
        const mintAmount = web3.utils.toWei("1000", "mwei"); // 1000 USDT0 (6 decimals)
        await token.mint(signer, mintAmount);
        const newBalance = await token.balanceOf(signer);
        console.log(`   New Balance: ${web3.utils.fromWei(newBalance.toString(), "mwei")} USDT0`);
    }

    // Transfer amount: 10 USDT0
    const transferAmount = web3.utils.toWei("10", "mwei");

    // Create EIP-712 authorization
    console.log("\n📝 Creating EIP-3009 Authorization...");

    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const validAfter = Math.floor(Date.now() / 1000) - 60;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    // EIP-712 typed data
    const domain = {
        name: name,
        version: "1",
        chainId: Number(chainId),
        verifyingContract: TOKEN_ADDRESS,
    };

    const types = {
        TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
        ],
    };

    const message = {
        from: signer,
        to: recipient,
        value: transferAmount,
        validAfter: validAfter,
        validBefore: validBefore,
        nonce: nonce,
    };

    console.log("   Message:", JSON.stringify(message, null, 2));

    // Create wallet from private key for signing
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ PRIVATE_KEY not set");
        process.exit(1);
    }

    const wallet = new ethers.Wallet(privateKey);

    // Sign with EIP-712
    const signature = await wallet.signTypedData(domain, types, message);
    const sig = ethers.Signature.from(signature);

    console.log(`   Signature v: ${sig.v}`);
    console.log(`   Signature r: ${sig.r}`);
    console.log(`   Signature s: ${sig.s}`);
    console.log(`   Full signature: ${signature}`);

    // Check nonce state before
    const nonceUsedBefore = await token.authorizationState(signer, nonce);
    console.log(`\n   Nonce used before: ${nonceUsedBefore}`);

    // Execute transferWithAuthorization using the bytes signature version (7 params)
    // The contract has two overloads - Truffle exposes the (bytes signature) version
    console.log("\n🚀 Executing transferWithAuthorization...");

    const tx = await token.transferWithAuthorization(
        signer,
        recipient,
        transferAmount,
        validAfter,
        validBefore,
        nonce,
        signature, // bytes signature instead of v,r,s
        { from: signer }
    );

    console.log(`   Transaction hash: ${tx.tx}`);
    console.log(`   Gas used: ${tx.receipt.gasUsed}`);

    // Check nonce state after
    const nonceUsedAfter = await token.authorizationState(signer, nonce);
    console.log(`\n   Nonce used after: ${nonceUsedAfter}`);

    // Check balances after
    const finalBalance = await token.balanceOf(signer);
    const recipientBalance = await token.balanceOf(recipient);

    console.log(`\n📊 Final Balances:`);
    console.log(`   Signer:    ${web3.utils.fromWei(finalBalance.toString(), "mwei")} USDT0`);
    console.log(`   Recipient: ${web3.utils.fromWei(recipientBalance.toString(), "mwei")} USDT0`);

    // Try to use same nonce again (should fail)
    console.log("\n🔒 Testing nonce reuse protection...");
    try {
        await token.transferWithAuthorization(
            signer,
            recipient,
            transferAmount,
            validAfter,
            validBefore,
            nonce,
            signature,
            { from: signer }
        );
        console.log("   ❌ ERROR: Should have reverted!");
    } catch {
        console.log("   ✅ Correctly rejected: AuthorizationAlreadyUsed");
    }

    console.log("\n" + "═".repeat(60));
    console.log("✅ EIP-3009 Test Complete!");
}

void main().then(() => {
    process.exit(0);
});
