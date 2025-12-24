# Contributing Guidelines

Thank you for your interest in contributing to the Flare Hardhat Starter Kit. We welcome contributions that improve the examples, tooling, and developer experience for building on Flare.

## Ways to Contribute

### Issues

- **Bug Reports**: Found something broken? Open an issue with reproduction steps.
- **Feature Requests**: Have an idea for a new example or improvement? We'd love to hear it.
- **Questions**: Stuck on something? Open an issue and we'll help.

### Pull Requests

- Fix bugs or typos
- Add new contract examples
- Improve existing scripts
- Enhance documentation

## Development Workflow

### 1. Fork and Clone

Fork the repository and clone your fork locally:

```bash
git clone https://github.com/<your-username>/flare-hardhat-starter.git
cd flare-hardhat-starter
```

### 2. Install Dependencies

```bash
yarn
```

> **Note**: If you encounter issues with Yarn, you can use `npm install --force` as a fallback.

### 3. Create a Branch

Use descriptive branch names with appropriate prefixes:

| Prefix      | Use Case                          |
| ----------- | --------------------------------- |
| `feature/`  | New features or examples          |
| `fix/`      | Bug fixes                         |
| `chore/`    | Maintenance, config, dependencies |
| `docs/`     | Documentation updates             |
| `refactor/` | Code refactoring                  |

Example:

```bash
git checkout -b feature/new-ftso-example
```

### 4. Make Your Changes

Edit files in the appropriate directories:

- `contracts/` - Solidity smart contracts
- `scripts/` - TypeScript deployment and interaction scripts
- `utils/` - Shared utility functions

## Code Style

This project enforces consistent code style through automated tooling. All code must pass formatting and linting checks before it can be committed.

### Solidity Style

#### Naming Conventions

| Element              | Convention   | Example                         |
| -------------------- | ------------ | ------------------------------- |
| Contracts            | CamelCase    | `FTSOConsumer`                  |
| Events               | camelCase    | `priceUpdated`                  |
| Functions            | mixedCase    | `getPrice()`, `updateFeed()`    |
| Constants            | SNAKE_CASE   | `MAX_SUPPLY`, `DEFAULT_TIMEOUT` |
| Immutable variables  | SNAKE_CASE   | `OWNER`, `DECIMALS`             |
| State variables      | mixedCase    | `totalSupply`, `feedId`         |

#### Formatting Rules

- **Line length**: 80 characters maximum
- **Indentation**: 4 spaces (no tabs)
- **Quotes**: Double quotes for strings
- **Bracket spacing**: No spaces inside brackets
- **Imports**: Must be at the top of the file

#### Example Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ExampleContract {
    uint256 public constant MAX_VALUE = 1000;
    address public immutable OWNER;

    uint256 public currentValue;

    event valueUpdated(uint256 indexed newValue, address indexed updater);

    constructor() {
        OWNER = msg.sender;
    }

    function updateValue(uint256 _newValue) external {
        require(_newValue <= MAX_VALUE, "Value exceeds maximum");
        currentValue = _newValue;
        emit valueUpdated(_newValue, msg.sender);
    }
}
```

### TypeScript Style

#### Formatting Rules

- **Line length**: 120 characters maximum
- **Indentation**: 4 spaces
- **Quotes**: Double quotes
- **Semicolons**: Required
- **Trailing commas**: ES5 style

#### Linting

TypeScript files in `scripts/` and `test/` are linted with ESLint using the `@flarenetwork/eslint-config-flare` configuration.

### Running Formatters and Linters

Check formatting and linting:

```bash
yarn format:check    # Check all formatting
yarn lint:check      # Check all linting
```

Auto-fix issues:

```bash
yarn format:fix      # Fix formatting issues
yarn lint:fix        # Fix linting issues
```

Or run both:

```bash
yarn format:fix && yarn lint:fix
```

#### Individual Commands

| Command                      | Description                    |
| ---------------------------- | ------------------------------ |
| `yarn format:check-solidity` | Check Solidity formatting      |
| `yarn format:fix-solidity`   | Fix Solidity formatting        |
| `yarn format:check-typescript` | Check TypeScript formatting  |
| `yarn format:fix-typescript` | Fix TypeScript formatting      |
| `yarn lint:check-solidity`   | Check Solidity linting         |
| `yarn lint:fix-solidity`     | Fix Solidity linting           |
| `yarn lint:check-typescript` | Check TypeScript linting       |
| `yarn lint:fix-typescript`   | Fix TypeScript linting         |

## Pre-Commit Hooks

This repository uses [Husky](https://typicode.github.io/husky/) to run pre-commit hooks. When you attempt to commit, the following checks run automatically:

1. `yarn format:check` - Verifies code formatting
2. `yarn lint:check` - Verifies linting rules

If either check fails, your commit will be blocked. To fix:

```bash
# Fix all issues
yarn format:fix
yarn lint:fix

# Re-stage your changes
git add .

# Commit again
git commit -m "your message"
```

### Bypassing Hooks (Not Recommended)

In rare cases where you need to bypass hooks:

```bash
git commit --no-verify -m "your message"
```

> **Warning**: Only bypass hooks if you have a valid reason.

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>
```

### Types

| Type       | Description                              |
| ---------- | ---------------------------------------- |
| `feat`     | New feature or example                   |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation changes                    |
| `chore`    | Maintenance, dependencies, config        |
| `refactor` | Code refactoring (no feature change)     |
| `style`    | Code style changes (formatting, etc.)    |
| `test`     | Adding or updating tests                 |
| `ci`       | CI/CD changes                            |

### Scope (Optional)

Use scope to indicate the area of change:

- `fassets` - F-Assets related
- `ftso` - FTSO related
- `fdc` - FDC related
- `script` - Script changes
- `contract` - Contract changes

### Examples

```bash
feat(ftso): add anchor feed consumer example
fix(fassets): correct redemption calculation
chore: update dependencies
docs: improve script README
refactor(script): extract common utilities
```

## Pull Request Guidelines

### Before Submitting

1. **Compile contracts**:
   ```bash
   yarn hardhat compile
   ```

2. **Run format and lint checks**:
   ```bash
   yarn format:check
   yarn lint:check
   ```

3. **Test your changes** (if applicable):
   ```bash
   yarn hardhat run scripts/your-script.ts --network coston2
   ```

### PR Requirements

- **Keep changes focused**: One logical change per PR
- **Discuss large changes first**: Open an issue before major refactors
- **Update documentation**: If your change affects usage, update the README
- **Ensure CI passes**: All checks must pass before review
- **Descriptive title**: Use conventional commit format for PR titles

### PR Template

When creating a PR, include:

```markdown
## Summary

Brief description of changes.

## Changes

- Change 1
- Change 2

## Testing

How were these changes tested?

## Checklist

- [ ] Code compiles without errors
- [ ] Formatting and linting pass
- [ ] Documentation updated (if needed)
```

## Project Structure

```
├── contracts/           # Solidity smart contracts
│   ├── fassets/         # F-Assets integration
│   ├── fdcExample/      # FDC attestation examples
│   ├── crossChainFdc/   # Cross-chain FDC examples
│   └── ...
├── scripts/             # TypeScript scripts
│   ├── fassets/         # F-Assets scripts
│   ├── fdcExample/      # FDC scripts
│   └── ...
├── utils/               # Shared utilities
├── typechain-types/     # Generated types (do not edit)
└── artifacts/           # Compiled contracts (do not edit)
```

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure required variables:
   - `PRIVATE_KEY` - Your wallet private key (never commit this)
   - API keys as needed for your work

## Supported Networks

| Network   | Chain ID | Type     |
| --------- | -------- | -------- |
| Coston    | 16       | Testnet  |
| Coston2   | 114      | Testnet  |
| Songbird  | 19       | Canary   |
| Flare     | 14       | Mainnet  |

## Getting Help

If you run into issues:

1. Check existing [issues](https://github.com/flare-foundation/flare-hardhat-starter/issues)
2. Review the [Flare Developer Hub](https://dev.flare.network/)
3. Open a new issue with details about your problem

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
