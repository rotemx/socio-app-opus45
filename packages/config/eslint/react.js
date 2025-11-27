/**
 * @socio/config - React ESLint Configuration
 *
 * ESLint rules specific to React web applications.
 * Extends the base configuration with React-specific plugins and rules.
 */
const base = require('./base');

module.exports = {
  ...base,
  env: {
    ...base.env,
    browser: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parserOptions: {
    ...base.parserOptions,
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [...base.plugins, 'react', 'react-hooks'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    ...base.rules,
    // React specific rules
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'react/jsx-curly-brace-presence': ['warn', { props: 'never', children: 'never' }],
    'react/self-closing-comp': 'warn',
    'react/jsx-boolean-value': ['warn', 'never'],
    'react/jsx-no-useless-fragment': 'warn',

    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
