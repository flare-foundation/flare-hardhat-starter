# Flare Hardhat Starter Kit

This is a starter kit for interacting with Flare blockchain.
It provides example code for interacting with enshrined Flare protocol, and useful deployed contracts.
It also demonstrates, how the official Flare smart contract periphery [package](https://www.npmjs.com/package/@flarenetwork/flare-periphery-contracts) can be used in your projects.

## Getting started

If you are new to Hardhat please check the [Hardhat getting started doc](https://hardhat.org/hardhat-runner/docs/getting-started#overview)

1. Clone and install dependencies:

   ```console
   git clone https://github.com/flare-foundation/flare-hardhat-starter.git
   cd flare-hardhat-starter
   ```

   and then run:

   ```console
   yarn
   ```

   or

   ```console
   npm install
   ```

2. Set up `.env` file

   ```console
   mv .env.example .env
   ```

3. Change the `PRIVATE_KEY` in the `.env` file to yours

4. Compile the project

   ```console
   yarn hardhat compile
   ```

   or

   ```console
   npx hardhat compile
   ```

   This will compile all `.sol` files in your `/contracts` folder.
   It will also generate artifacts that will be needed for testing.
   Contracts `Imports.sol` import MockContracts and Flare related mocks, thus enabling mocking of the contracts from typescript.

5. Run Tests

   ```console
   yarn hardhat test
   ```

   or

   ```console
   npx hardhat test
   ```

6. Deploy

   Check the `hardhat.config.ts` file, where you define which networks you want to interact with.
   Flare mainnet & test network details are already added in that file.

   Make sure that you have added API Keys in the `.env` file

   ```console
   npx hardhat run scripts/tryDeployment.ts
   ```

## Repository structure

```
├── contracts: Solidity smart contracts
├── scripts: Typescript scripts that interact with the blockchain
├── test
├── hardhat.config.ts
├── package.json
├── README.md
├── tsconfig.json
└── yarn.lock
```

## Contributing

Before opening a pull request, lint and format the code.
You can do that by running the following commands.

```sh
yarn format:fix
```

```sh
yarn lint:fix
```

## Clean repository

If you want to start building your projects from a repository that is already setup to work with Flare correctly, but you do not want to keep any of the examples, these are the files you should delete:

- all files in the `contracts/` folder
- all files in the `scripts/` folder, except for the `scripts/fdcExample/Base.ts` which might come in useful

A shell command that does this is:

```sh
rm -rf contracts/* & mv scripts/fdcExample/Base.ts ./Base.ts & rm -rf scripts/* & mv ./Base.ts scripts/Base.ts
```

## Resources

- [Flare Developer Hub](https://dev.flare.network/)
- [Hardhat Guides](https://dev.flare.network/fdc/guides/hardhat)
- [Hardhat Docs](https://hardhat.org/docs)
