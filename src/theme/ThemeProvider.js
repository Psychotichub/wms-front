import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Appearance, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { lightTheme } from './light';
import { darkTheme } from './dark';
import { typography as baseTypography, fontFamilies } from './colors';
import { elevation } from './elevation';

const THEME_STORAGE_KEY = '@wms_theme_preference';

const ThemeContext = createContext({
  theme: lightTheme,
  themePreference: 'system',
  setThemePreference: () => {},
  fontsLoaded: false
});

const fontSource = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold
};

function mergeTypography(fontsLoaded) {
  if (!fontsLoaded) return baseTypography;
  return {
    h1: { ...baseTypography.h1, fontFamily: fontFamilies.bold },
    h2: { ...baseTypography.h2, fontFamily: fontFamilies.bold },
    h3: { ...baseTypography.h3, fontFamily: fontFamilies.semibold },
    body: { ...baseTypography.body, fontFamily: fontFamilies.medium },
    small: { ...baseTypography.small, fontFamily: fontFamilies.regular }
  };
}

export const ThemeProvider = ({ children }) => {
  const [fontsLoaded, fontError] = useFonts(fontSource);
  const [themePreference, setThemePreferenceState] = useState('system');
  const [hydrated, setHydrated] = useState(false);

  const systemScheme = Appearance.getColorScheme();
  const [system, setSystem] = useState(systemScheme);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!cancelled && (stored === 'system' || stored === 'light' || stored === 'dark')) {
          setThemePreferenceState(stored);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const resolvedMode = useMemo(() => {
    if (themePreference === 'light') return 'light';
    if (themePreference === 'dark') return 'dark';
    return system === 'dark' ? 'dark' : 'light';
  }, [themePreference, system]);

  const setThemePreference = useCallback(async (value) => {
    if (value !== 'system' && value !== 'light' && value !== 'dark') return;
    setThemePreferenceState(value);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const palette = useMemo(() => {
    const base = resolvedMode === 'dark' ? darkTheme : lightTheme;
    const typo = mergeTypography(Boolean(fontsLoaded) && !fontError);
    return { ...base, typography: typo };
  }, [resolvedMode, fontsLoaded, fontError]);

  const value = useMemo(
    () => ({
      theme: palette,
      themePreference,
      setThemePreference,
      resolvedMode,
      fontsLoaded: fontsLoaded || !!fontError
    }),
    [palette, themePreference, setThemePreference, resolvedMode, fontsLoaded, fontError]
  );

  if (!fontsLoaded && !fontError) {
    return (
      <View style={loaderStyles.container}>
        <ActivityIndicator size="large" color="#22d3ee" accessibilityLabel="Loading fonts" />
      </View>
    );
  }

  if (!hydrated) {
    return (
      <View style={loaderStyles.container}>
        <ActivityIndicator size="large" color="#22d3ee" accessibilityLabel="Loading settings" />
      </View>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

const loaderStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617'
  }
});

export const useThemeTokens = () => {
  const { theme } = useContext(ThemeContext);
  return theme;
};

export const useTheme = () => useContext(ThemeContext);

/** Card / surface shadow — uses shared elevation.medium */
export const shadowStyle = StyleSheet.create({
  card: {
    ...elevation.medium
  }
});

export { elevation };
