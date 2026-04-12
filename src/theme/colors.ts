// @ts-nocheck
export const baseColors = {
  /** Electric cyan — primary actions, “live” UI */
  primary: '#0891b2',
  /** Energized green — OK / success states */
  success: '#10b981',
  /** Voltage / caution amber */
  warning: '#f59e0b',
  /** Arc / fault — coral-red */
  danger: '#f43f5e',
  /** Secondary readouts — violet (metering) */
  info: '#8b5cf6',

  gray50: '#f0f9ff',
  gray100: '#e2e8f0',
  gray200: '#cbd5e1',
  gray300: '#94a3b8',
  gray400: '#64748b',
  gray500: '#475569',
  gray600: '#334155',
  gray700: '#1e293b',
  gray800: '#0f172a',
  /** Near void — panels on dark */
  gray900: '#020617'
};

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24
};

/** Font family keys match @expo-google-fonts/plus-jakarta-sans load names (wired in ThemeProvider). */
export const fontFamilies = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold'
};

/**
 * Base typography — slightly wider tracking on titles for a technical read.
 */
export const typography = {
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 32, letterSpacing: -0.2 },
  h2: { fontSize: 20, fontWeight: '700', lineHeight: 28, letterSpacing: -0.15 },
  h3: { fontSize: 18, fontWeight: '700', lineHeight: 24, letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '500', lineHeight: 18 }
};
