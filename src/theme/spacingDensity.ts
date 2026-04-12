// @ts-nocheck
import { Platform } from 'react-native';

export const SPACING_DENSITY_STORAGE_KEY = '@wms_spacing_density';

/** Persisted UI density — scales `theme.spacing` (padding, gaps, section rhythm). */
export const SPACING_DENSITIES = ['compact', 'default', 'comfortable'];

export const SPACING_DENSITY_MULTIPLIERS = {
  compact: 0.85,
  default: 1,
  comfortable: 1.18
};

export function isValidSpacingDensity(value) {
  return SPACING_DENSITIES.includes(value);
}

export function scaleThemeSpacing(spacing, density) {
  const m = SPACING_DENSITY_MULTIPLIERS[density] ?? SPACING_DENSITY_MULTIPLIERS.default;
  const out = {};
  for (const key of Object.keys(spacing)) {
    out[key] = Math.max(2, Math.round(spacing[key] * m));
  }
  return out;
}

/** Web: sync read for first paint (matches AsyncStorage key in localStorage). */
export function readStoredSpacingDensitySync() {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(SPACING_DENSITY_STORAGE_KEY);
    if (isValidSpacingDensity(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}
