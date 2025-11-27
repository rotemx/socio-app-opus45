const reactNativeConfig = require('../../packages/config/eslint/react-native');

module.exports = {
  ...reactNativeConfig,
  parserOptions: {
    ...reactNativeConfig.parserOptions,
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    ...(reactNativeConfig.ignorePatterns || []),
    'node_modules/',
    'ios/',
    'android/',
    '*.config.js',
    'babel.config.js',
    'metro.config.js',
    'jest.config.js',
    'jest.setup.js',
    '.eslintrc.js',
    'index.js',
    '*.d.ts',
  ],
  overrides: [
    ...(reactNativeConfig.overrides || []),
    {
      // Test files
      files: ['**/__tests__/**/*', '**/*.test.*'],
      env: {
        jest: true,
      },
    },
  ],
};
