import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IERC20Metadata } from "../../typechain-ethers";

export async function tokenBalance(hre: HardhatRuntimeEnvironment, tokenName: string, address: string) {
    if (tokenName === "NAT") {
        const balance = await hre.ethers.provider.getBalance(address);
        return ["NAT", 18, balance] as const;
    } else {
        const tokenDeploy = await hre.deployments.get(tokenName);
        const token = await hre.ethers.getContractAt("IERC20Metadata", tokenDeploy.address) as IERC20Metadata;
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const balance = await token.balanceOf(address);
        return [symbol, decimals, balance] as const;
    }
}