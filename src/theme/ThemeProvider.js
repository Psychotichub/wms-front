import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Appearance, StyleSheet, Platform } from 'react-native';
import { lightTheme } from './light';
import { darkTheme } from './dark';

const ThemeContext = createContext({
  theme: lightTheme,
  mode: 'light',
  setMode: () => {}
});

export const ThemeProvider = ({ children }) => {
  const system = Appearance.getColorScheme();
  const [mode, setMode] = useState(system || 'light');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (!mode || mode === 'system') {
        setMode(colorScheme || 'light');
      }
    });
    return () => sub.remove();
  }, [mode]);

  const palette = useMemo(() => {
    if (mode === 'dark') return darkTheme;
    if (mode === 'light') return lightTheme;
    return system === 'dark' ? darkTheme : lightTheme;
  }, [mode, system]);

  const value = useMemo(() => ({ theme: palette, mode, setMode }), [palette, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeTokens = () => {
  const { theme } = useContext(ThemeContext);
  return theme;
};

export const useTheme = () => useContext(ThemeContext);

export const shadowStyle = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12
      },
      android: { elevation: 4 },
      default: { boxShadow: '0px 8px 16px rgba(0,0,0,0.12)' }
    })
  }
});

