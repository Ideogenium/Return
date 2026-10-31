// Jest setup file
// Les matchers RNTL sont intégrés automatiquement dans @testing-library/react-native v12+

// Mock AsyncStorage pour les tests
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Initialisation i18n pour tous les tests
import './src/config/i18n.config';

// expo-file-system : jest-expo ne simule que l'ancienne API (getInfoAsync…). Ce mock simule
// la classe File du SDK 54, dont la taille est réglable par test (__mocks__/expoFileSystemMock.ts).
jest.mock('expo-file-system', () => require('./__mocks__/expoFileSystemMock'));
