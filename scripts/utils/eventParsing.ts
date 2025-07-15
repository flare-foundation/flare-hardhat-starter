// Function to parse events by name from raw logs
export function parseEventByName(rawLogs: any[], eventName: string, contractAbi: any) {
    // Get the event ABI
    const eventAbi = contractAbi.find(e => e.name === eventName);
    if (!eventAbi) {
        console.log(`Event ${eventName} not found in ABI`);
        return [];
    }

    // Get the event signature hash
    const eventSignatureHash = web3.eth.abi.encodeEventSignature(eventAbi);

    return (
        rawLogs
            // Filter the logs to only include the event
            .filter(log => log.topics[0] === eventSignatureHash)
            .map(log => {
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
