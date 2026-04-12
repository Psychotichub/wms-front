// @ts-nocheck
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback
} from 'react';
import { ActivityIndicator, Appearance, Platform, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { lightTheme } from './light';
import { darkTheme } from './dark';
import { typography as baseTypography, fontFamilies } from './colors';
import { elevation } from './elevation';
import {
  SPACING_DENSITY_STORAGE_KEY,
  readStoredSpacingDensitySync,
  scaleThemeSpacing,
  isValidSpacingDensity
} from './spacingDensity';

const THEME_STORAGE_KEY = '@wms_theme_preference';

/** Web: read before first paint so font/settings loaders match saved light/dark (AsyncStorage is async). */
function readStoredThemePreferenceSync() {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* private mode / denied */
  }
  return null;
}

function preferencesBootstrap() {
  const syncTheme = readStoredThemePreferenceSync();
  const syncDensity = readStoredSpacingDensitySync();
  return {
    themePreference: syncTheme ?? 'system',
    /** True when theme was read from localStorage (web) — skip blocking on AsyncStorage. */
    themeStorageKnown: syncTheme !== null,
    spacingDensity: isValidSpacingDensity(syncDensity) ? syncDensity : 'default'
  };
}

function loaderColorsForMode(mode) {
  const base = mode === 'dark' ? darkTheme : lightTheme;
  return { backgroundColor: base.colors.background, spinner: base.colors.primary };
}

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
  const boot = useMemo(() => preferencesBootstrap(), []);
  const [themePreference, setThemePreferenceState] = useState(boot.themePreference);
  const [spacingDensity, setSpacingDensityState] = useState(boot.spacingDensity);
  const [hydrated, setHydrated] = useState(boot.themeStorageKnown);

  const systemScheme = Appearance.getColorScheme();
  const [system, setSystem] = useState(systemScheme);

  useLayoutEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([THEME_STORAGE_KEY, SPACING_DENSITY_STORAGE_KEY]);
        const map = Object.fromEntries(pairs);
        if (!cancelled) {
          const storedTheme = map[THEME_STORAGE_KEY];
          if (storedTheme === 'system' || storedTheme === 'light' || storedTheme === 'dark') {
            setThemePreferenceState(storedTheme);
          }
          const storedDensity = map[SPACING_DENSITY_STORAGE_KEY];
          if (isValidSpacingDensity(storedDensity)) {
            setSpacingDensityState(storedDensity);
          }
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

  const setSpacingDensity = useCallback(async (value) => {
    if (!isValidSpacingDensity(value)) return;
    setSpacingDensityState(value);
    try {
      await AsyncStorage.setItem(SPACING_DENSITY_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const palette = useMemo(() => {
    const base = resolvedMode === 'dark' ? darkTheme : lightTheme;
    const typo = mergeTypography(Boolean(fontsLoaded) && !fontError);
    return {
      ...base,
      typography: typo,
      spacing: scaleThemeSpacing(base.spacing, spacingDensity)
    };
  }, [resolvedMode, fontsLoaded, fontError, spacingDensity]);

  const value = useMemo(
    () => ({
      theme: palette,
      themePreference,
      setThemePreference,
      spacingDensity,
      setSpacingDensity,
      resolvedMode,
      fontsLoaded: fontsLoaded || !!fontError
    }),
    [palette, themePreference, setThemePreference, spacingDensity, setSpacingDensity, resolvedMode, fontsLoaded, fontError]
  );

  const loaderChrome = useMemo(() => loaderColorsForMode(resolvedMode), [resolvedMode]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={[loaderStyles.container, { backgroundColor: loaderChrome.backgroundColor }]}>
        <ActivityIndicator size="large" color={loaderChrome.spinner} accessibilityLabel="Loading fonts" />
      </View>
    );
  }

  if (!hydrated) {
    return (
      <View style={[loaderStyles.container, { backgroundColor: loaderChrome.backgroundColor }]}>
        <ActivityIndicator size="large" color={loaderChrome.spinner} accessibilityLabel="Loading settings" />
      </View>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

const loaderStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
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
