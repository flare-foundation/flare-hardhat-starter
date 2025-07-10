/**
 * Links a library to a contract before deployment
 * @param contract - The contract artifact that needs library linking
 * @param library - The deployed library instance
 * @returns The linked contract artifact
 */
export function linkLibrary(contract: any, library: any): any {
    contract.link(library);
    return contract;
}

/**
 * Deploy and link a library to a contract
 * @param contract - The contract artifact that needs library linking
 * @param libraryArtifact - The library artifact to deploy
 * @returns Object containing the deployed library and linked contract
 */
export async function deployAndLinkLibrary(
    contract: any,
    libraryArtifact: any
): Promise<{ library: any; linkedContract: any }> {
    const library = await libraryArtifact.new();
    console.log(`Library deployed to: ${library.address}`);
    
    const linkedContract = linkLibrary(contract, library);
    
    return { library, linkedContract };
} 