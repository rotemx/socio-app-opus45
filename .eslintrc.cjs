/**
 * Root ESLint Configuration for Socio Monorepo
 *
 * This configuration serves as the base for all packages.
 * Individual apps/packages should create their own .eslintrc.cjs
 * that extends from @socio/config/eslint/* for specific configurations.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      },
    ],

    // React rules
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react/prop-types': 'off',

    // General rules
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always', { null: 'ignore' }],
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    '.turbo/',
    'coverage/',
  ],
  overrides: [
    {
      files: ['packages/ui/src/**/*.tsx', 'apps/mobile/src/**/*.tsx'],
      rules: {
        'react/jsx-no-undef': 'off',
      },
    },
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
      env: {
        jest: true,
      },
      rules: {
        // Keep type safety in tests - use unknown instead of any when needed
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
};
