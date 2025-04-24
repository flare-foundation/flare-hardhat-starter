// Contract address depends on the network it was deployed at

const tokenAddresses = new Map([
    ["coston", "0xb979de129aFA8bBEC5d46314588B573aD9C72db6"],
    ["coston2", "0xfc896CD7115dD2E901a573d11A598d9c8222f58A"],
]);

const readerAddresses = new Map([
    ["coston", "0x16A446c2Bf18421c5d79a21f7Cc3636dFfDB0612"],
    ["coston2", "0xD069D5c27211229afdCc173F2a46cc4aFb320911"],
]);

const proofOfReservesAddress = "0x93159f8AEE952CBa03aB8Fd0a913E7935281E7dF";

const transactionHashes = new Map([
    ["coston", "0x192ff7eb839157d037f023d006aec47afaad6dc8ed98618a5e8803992518caeb"],
    ["coston2", "0x7149c77b4ecb68ca9faea3991cf24864dc4fbf09c6c52f0c203c748456b80658"],
]);

export { tokenAddresses, readerAddresses, proofOfReservesAddress, transactionHashes };
