/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  setupFilesAfterEnv: ['./jest.setup-after-env.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|native-base|react-native-svg|react-native-paper|react-native-paper-dates|color|color-string|color-name|color-convert|simple-swizzle|is-arrayish|msw|until-async)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^msw/node$': '<rootDir>/node_modules/msw/lib/node/index.js',
    '^expo-image-picker$': '<rootDir>/__mocks__/expo-image-picker.ts',
    '^expo-notifications$': '<rootDir>/__mocks__/expo-notifications.ts',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/types/**'],
  // Anti-regression safety net: ~2 points under the level measured on 2026-10-28
  // (statements 65.21, branches 67.89, functions 62.43, lines 65.23). Not a target.
  coverageThreshold: {
    global: { statements: 63, branches: 65, functions: 60, lines: 63 },
  },
};
