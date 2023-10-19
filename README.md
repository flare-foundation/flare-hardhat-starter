# Flare Hardhat Starter Kit

## Getting started

If you are new to hardhat please checkout [hardhat getting started doc](https://hardhat.org/hardhat-runner/docs/getting-started#overview)

### Clone and install dependencies:

```
git clone https://github.com/flare-foundation/flare-hardhat-starter.git
cd flare-hardhat-starter
```
then run:

```
npm install
```
or 
```
yarn
```

**Now Make sure to first copy .env.example into .env and set your private key**

Now you can compile

```
yarn hardhat compile
or 
npm hardhat compile
```

This will compile all .sol files in your /contracts folder. It will also generate artifacts, that will be needed for testing. Contracts Imports.sol imports MockContracts and flare related mocks thus enabling mocking the contracts from typescript.

Run Tests
```
yarn hardhat test
or 
npm hardhat test
```

& Deploy

Checkout the ```hardhat.config.ts``` file where you define which networks you want to interact with. Flare mainnet & test networks details are already added in that file!
Again make sure that you have added API Keys in .env file

```
yarn hardhat deploy
or 
npm hardhat deploy
```

Thank You!
### Resources:
- [Flare Dev Docs](https://docs.flare.network/dev/)
- [Hardhat Docs](https://hardhat.org/docs)
