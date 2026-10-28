// Runs after the test framework is installed (setupFilesAfterEnv).
import { configure } from '@testing-library/react-native';

// Async assertions (waitFor, findBy*) wait up to 5 s instead of 1 s: a passing test is
// just as fast, but a loaded machine or CI runner no longer fails it at random.
configure({ asyncUtilTimeout: 5000 });
