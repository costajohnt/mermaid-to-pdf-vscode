import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const sharedRules = {
    '@typescript-eslint/naming-convention': [
        'warn',
        {
            selector: 'variable',
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
            leadingUnderscore: 'allow',
        },
    ],
    'curly': 'warn',
    'eqeqeq': 'warn',
    'no-throw-literal': 'warn',
};

const sharedConfig = {
    languageOptions: {
        parser: tsparser,
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    plugins: {
        '@typescript-eslint': tseslint,
    },
    rules: sharedRules,
};

export default [
    {
        files: ['src/**/*.ts'],
        ignores: ['**/*.d.ts', 'dist/**', 'out/**'],
        ...sharedConfig,
    },
    {
        files: ['mermaid-to-pdf-mcp/src/**/*.ts'],
        ignores: ['**/*.d.ts', '**/dist/**'],
        ...sharedConfig,
    },
];
