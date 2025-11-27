/**
 * @socio/config - NestJS ESLint Configuration
 *
 * ESLint rules specific to NestJS backend applications.
 * Extends the base configuration with Node.js backend-specific rules.
 */
const base = require('./base');

module.exports = {
  ...base,
  env: {
    ...base.env,
    jest: true,
  },
  rules: {
    ...base.rules,
    // NestJS specific rules
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': [
      'warn',
      {
        allow: ['constructors'],
      },
    ],
    // NestJS DI relies on class imports as values for metadata reflection
    // The consistent-type-imports rule is too aggressive for NestJS services
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
        disallowTypeAnnotations: false,
      },
    ],

    // Allow console in backend for logging (use proper logger in production)
    'no-console': 'off',
  },
  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
    {
      files: ['**/*.dto.ts', '**/*.entity.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
