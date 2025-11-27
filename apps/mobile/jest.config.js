module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@socio/shared$': '<rootDir>/../../packages/shared/src',
    '^@socio/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@socio/ui$': '<rootDir>/../../packages/ui/src',
    '^@socio/ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
    '^@socio/types$': '<rootDir>/../../packages/types/src',
    '^@socio/types/(.*)$': '<rootDir>/../../packages/types/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-safe-area-context|react-native-screens|nativewind)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  testEnvironment: 'node',
};
