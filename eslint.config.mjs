// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  // linting with type information
  tseslint.configs.recommendedTypeChecked,
  {
    ignores: ['eslint.config.mjs'],
  },
  // tells parser how to find the tsconfig
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // import plugins for rules
    // plugins: { import: importPlugin },
    rules: {
      // Disables the rule that prefers the namespace keyword over the module keyword for declaring TypeScript namespaces.
      '@typescript-eslint/prefer-namespace-keyword': 'off',
      // Disables the rule that disallows the use of custom TypeScript namespaces.
      '@typescript-eslint/no-namespace': 'off',
      // Allow explicit type declarations for variables or parameters initialized to a number, string, or boolean.
      '@typescript-eslint/no-inferrable-types': 'off',
      // Warns about unused variables, but ignores variables that start with an underscore (^_) and arguments that match any pattern (.).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '.',
        },
      ],
      // Require for-in loops to include an if statement that checks hasOwnProperty.
      'guard-for-in': 'warn',
      // Errors when a case in a switch statement falls through to the next case without a break statement or other termination.
      'no-fallthrough': 'error',
      // Disable the rules that disallows the use of the any type
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Allow any type.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Override rules for specific files
  {
    files: ['test/**/*.ts'],
    rules: {
      // Disables the rule that disallows constant expressions in conditions (e.g., if (true)).
      'no-constant-condition': 'off',
      // Disables the rule that disallows non-null assertions using the ! postfix operator.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Disables the rule that disallows unused variables.
      '@typescript-eslint/no-unused-vars': 'off',
      // Disables the rule that disallows unused expressions.
      '@typescript-eslint/no-unused-expressions': 'off',
      // Disables the rule that disallows the use of unsafe assigment
      '@typescript-eslint/no-unsafe-assignment': 'off',
      // Disables the rule that disallows the use of unsafe member access
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // Disables the rule that disallows the use of unsafe argument
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
