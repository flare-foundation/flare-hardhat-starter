// @ts-check
import { includeIgnoreFile } from "@eslint/compat";
import { defaultConfig } from "@flarenetwork/eslint-config-flare";
import prettier from "eslint-config-prettier";
import path from "node:path";
import { fileURLToPath } from "node:url";

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".gitignore");

export default [
    includeIgnoreFile(gitignorePath),
    ...defaultConfig,
    prettier,
    {
        rules: {
            // Disable the rules that disallows the use of the any type
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            // Allow any type.
            "@typescript-eslint/no-explicit-any": "off",
            // Override rules for specific files
        },
    },
    {
        files: ["test/**/*.ts"],
        rules: {
            // Disables the rule that disallows constant expressions in conditions (e.g., if (true)).
            "no-constant-condition": "off",
            // Disables the rule that disallows non-null assertions using the ! postfix operator.
            "@typescript-eslint/no-non-null-assertion": "off",
            // Disables the rule that disallows unused variables.
            "@typescript-eslint/no-unused-vars": "off",
            // Disables the rule that disallows unused expressions.
            "@typescript-eslint/no-unused-expressions": "off",
            // Disables the rule that disallows the use of unsafe assignment
            "@typescript-eslint/no-unsafe-assignment": "off",
            // Disables the rule that disallows the use of unsafe member access
            "@typescript-eslint/no-unsafe-member-access": "off",
            // Disables the rule that disallows the use of unsafe argument
            "@typescript-eslint/no-unsafe-argument": "off",
        },
    },
];
