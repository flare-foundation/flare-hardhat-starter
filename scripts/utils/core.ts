import fs from "fs";
import BN from "bn.js";

export function toHex(data: string) {
    let result = "";
    for (let i = 0; i < data.length; i++) {
        result += data.charCodeAt(i).toString(16);
    }
    return result.padEnd(64, "0");
}

export function toUtf8HexString(data: string) {
    return "0x" + toHex(data);
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to parse events by name from raw logs
export function parseEvents(rawLogs: any[], eventName: string, contractAbi: any) {
    // Get the event ABI
    const eventAbi = contractAbi.find((e) => e.name === eventName);
    if (!eventAbi) {
        console.log(`Event ${eventName} not found in ABI`);
        return [];
    }

    // Get the event signature hash
    const eventSignatureHash = web3.eth.abi.encodeEventSignature(eventAbi);

    return (
        rawLogs
            // Filter the logs to only include the event
            .filter((log) => log.topics[0] === eventSignatureHash)
            .map((log) => {
                try {
                    // Decode the log data using the event ABI
                    const decoded = web3.eth.abi.decodeLog(
                        eventAbi.inputs,
                        log.data,
                        log.topics.slice(1) // skip the event signature hash
                    );

                    return {
                        log,
                        decoded,
                        eventName,
                    };
                } catch (e) {
                    console.log(`Error parsing ${eventName} event:`, e);
                    return null;
                }
            })
            // Remove any null results from failed parsing
            .filter(Boolean)
    );
}

export function logEvents(rawLogs: any, eventName: string, abi: any) {
    const events = parseEvents(rawLogs, eventName, abi);

    if (events.length > 0) {
        events.forEach((event: any) => {
            console.log(eventName, event.decoded);
        });

        return events;
    }
}

export function replaceInFile(fileName: string, pattern: string, replace: string) {
    const content = fs.readFileSync(fileName, "utf8");
    content.replace(pattern, replace);
    fs.writeFileSync(fileName, content);
}

export function formatTimestamp(ts: any) {
    const s = ts?.toString?.() ?? String(ts);
    const ms = Number(s) * 1000;
    return `${s} (${new Date(ms).toISOString()})`;
}

/**
 * Convert a BN to a BigInt
 */
export function bnToBigInt(bn: BN): bigint {
    return BigInt(bn.toString());
}

