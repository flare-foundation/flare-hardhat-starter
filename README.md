# Flare Solidity template project
## Get started
First copy `.env.example` into `.env` and set your private key.
Next run `yarn`. Running `yarn hardhat compile` will compile all `.sol` files in your `/contracts` folder.
It will also generate artifacts, that will be needed for testing. Contracts `Imports.sol` imports MockContracts and flare related mocks thus enabling mocking the contracts from typescript.
