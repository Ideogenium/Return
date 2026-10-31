import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';
import { lightTheme } from './src/config/theme.config';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import './src/config/i18n.config';

const navTheme = {
  dark: false,
  colors: {
    primary: lightTheme.colors.primary,
    background: lightTheme.colors.background,
    card: '#FFFFFF',
    text: lightTheme.colors.onSurface,
    border: '#C9C4BB',
    notification: lightTheme.colors.error,
  },
  fonts: DefaultTheme.fonts,
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <PaperProvider theme={lightTheme}>
      <NavigationContainer ref={navigationRef} theme={navTheme as never}>
        <RootNavigator />
        <StatusBar style="dark" />
      </NavigationContainer>
    </PaperProvider>
  );
}
