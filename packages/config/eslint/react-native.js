/**
 * @socio/config - React Native ESLint Configuration
 *
 * ESLint rules specific to React Native mobile applications.
 * Extends the React configuration with React Native-specific overrides.
 */
const react = require('./react');

module.exports = {
  ...react,
  env: {
    ...react.env,
  },
  globals: {
    __DEV__: 'readonly',
    fetch: 'readonly',
    FormData: 'readonly',
    requestAnimationFrame: 'readonly',
    cancelAnimationFrame: 'readonly',
  },
  rules: {
    ...react.rules,
    // React Native specific overrides
    'react/jsx-no-undef': 'off',
    'no-alert': 'warn',
  },
  overrides: [
    {
      files: ['**/*.tsx'],
      rules: {
        'react/jsx-no-undef': 'off',
      },
    },
    {
      files: ['metro.config.js', 'babel.config.js', 'jest.config.js', '*.config.js'],
      env: {
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
