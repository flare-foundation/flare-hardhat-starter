import { costonTokenAddress } from "./costonToken";
import { coston2TokenAddress } from "./coston2Token";
import { costonReaderAddress } from "./costonReader";
import { coston2ReaderAddress } from "./coston2Reader";
import { proofOfReservesAddress } from "./proofOfReserves";
import { costonTransaction } from "./costonTransaction";
import { coston2Transaction } from "./coston2Transaction";

// Contract address depends on the network it was deployed at
const tokenAddresses = new Map([
    ["coston", costonTokenAddress],
    ["coston2", coston2TokenAddress],
]);

const readerAddresses = new Map([
    ["coston", costonReaderAddress],
    ["coston2", coston2ReaderAddress],
]);

const transactionHashes = new Map([
    ["coston", costonTransaction],
    ["coston2", coston2Transaction],
]);

export { tokenAddresses, readerAddresses, proofOfReservesAddress, transactionHashes };
