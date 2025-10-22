import { subtask, task, types } from "hardhat/config";

task("send-oft", "Send OFT tokens")
    .addParam("from", "Address to send tokens from on the source chain")
    .addParam("to", "Address to send tokens to on the target chain")
    .addParam("target", "The target network name (e.g. 'sepolia')")
    .addParam("amount", "Amount of tokens in LD units")
    .addOptionalParam("minAmount", "Mainimum delivered amount of tokens in LD units (default: equal as amount)")
    .addFlag("hypercore", "Compose with sending to hypercore")
    .addOptionalParam("hypercoreGas", "gas to use for composer, default 150k")
    .addOptionalParam("hypercoreValue", "hype value to send to hypercore, default 0")
    .setAction(async ({ from, to, target, amount, minAmount, hypercore, hypercoreGas, hypercoreValue }:
        { from: string, to: string, target: string, amount: string, minAmount?: string, hypercore?: boolean, hypercoreGas?: string, hypercoreValue?: string }, hre) =>
    {
        const sendOft = await import("./send-oft");
        await sendOft.sendOFTTokens(hre, from, to, target, amount, minAmount, hypercore ? { gas: hypercoreGas, value: hypercoreValue } : undefined);
    });

task("token-balance", "Get token balance")
    .addPositionalParam("token", "Token deploy name")
    .addPositionalParam("address", "The address holding tokens")
    .setAction(async ({ token, address }: Record<string, string>, hre) => {
        const { tokenBalance } = await import("../../scripts/tasks/token-balance");
        const [symbol, decimals, balance] = await tokenBalance(hre, token, address);
        const balanceDec = Number(balance) / 10 ** Number(decimals);
        console.log(`${balanceDec} ${symbol}  (${balance} BU)`);
    });

subtask("lz-transaction-print", "To be used in lz:oapp:wire as '--sign-and-send-subtask'")
    .addFlag('ci', 'Continuous integration (non-interactive) mode. Will not ask for any input from the user')
    .addParam('transactions', 'List of OmniTransaction objects', undefined, types.any)
    .addParam('createSigner', 'Function that creates a signer for a particular network', undefined, types.any)
    .addParam('logger', 'Logger object (see @layerzerolabs/io-devtools', undefined, types.any, true)
    .addParam('onFailure', 'Function that handles sign & send failures', undefined, types.any, true)
    .setAction(async ({ transactions }, hre) => {
        for (let { point, data, description } of transactions) {
            const [networkName] = Object.entries(hre.userConfig.networks!).find(([k, v]) => v?.eid && v.eid === point.eid)!;
            console.log("------------------------------------------------------------------------------------------");
            console.log(`Network: ${networkName} (eid=${point.eid})`);
            console.log(`Address: ${point.address}`);
            console.log(`Data: ${data}`);
            console.log(`Description: ${description}`);
        }
    });
