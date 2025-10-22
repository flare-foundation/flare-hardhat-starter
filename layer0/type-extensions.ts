import 'hardhat/types/config';

interface OftAdapterConfig {
    tokenAddress: string;
}

interface RedeemComposerConfig {
    fAssetToken: string;
    assetManager: string;
}

declare module 'hardhat/types/config' {
    interface HardhatNetworkUserConfig {
        oftAdapter?: never;
        redeemComposer?: never;
        confirmationsRequired?: number;
    }

    interface HardhatNetworkConfig {
        oftAdapter?: never;
        redeemComposer?: never;
        confirmationsRequired?: number;
    }

    interface HttpNetworkUserConfig {
        oftAdapter?: OftAdapterConfig;
        redeemComposer?: RedeemComposerConfig;
        confirmationsRequired?: number;
    }

    interface HttpNetworkConfig {
        oftAdapter?: OftAdapterConfig;
        redeemComposer?: RedeemComposerConfig;
        confirmationsRequired?: number;
    }
}
