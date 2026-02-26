import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const sharedRules = {
    '@typescript-eslint/naming-convention': [
        'error',
        {
            selector: 'variable',
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
            leadingUnderscore: 'allow',
        },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    'curly': 'error',
    'eqeqeq': 'error',
    'no-throw-literal': 'error',
    'prefer-const': 'error',
};

export default [
    {
        files: ['src/**/*.ts'],
        ignores: ['**/*.d.ts', '**/*.test.ts', 'dist/**', 'out/**'],
        languageOptions: {
            parser: tsparser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: sharedRules,
    },
    {
        files: ['src/**/*.test.ts'],
        ignores: ['**/*.d.ts', 'dist/**', 'out/**'],
        languageOptions: {
            parser: tsparser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            ...sharedRules,
            // node:test describe/test return promises handled by the runner
            '@typescript-eslint/no-floating-promises': 'off',
        },
    },
    {
        files: ['mermaid-to-pdf-mcp/src/**/*.ts'],
        ignores: ['**/*.d.ts', '**/*.test.ts', '**/dist/**'],
        languageOptions: {
            parser: tsparser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                project: './mermaid-to-pdf-mcp/tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: sharedRules,
    },
    {
        files: ['mermaid-to-pdf-mcp/src/**/*.test.ts'],
        ignores: ['**/*.d.ts', '**/dist/**'],
        languageOptions: {
            parser: tsparser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                project: './mermaid-to-pdf-mcp/tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            ...sharedRules,
            // node:test describe/test return promises handled by the runner
            '@typescript-eslint/no-floating-promises': 'off',
        },
    },
];
