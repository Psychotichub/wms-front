// @ts-nocheck
import { baseColors, radii, spacing, typography } from './colors';

export const darkTheme = {
  mode: 'dark',
  colors: {
    background: baseColors.gray900,
    surface: '#0f172a',
    card: '#111827',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    muted: '#64748b',
    border: '#1e3a5f',
    /** Brighter cyan on dark — neon / energized readout */
    primary: '#22d3ee',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#fb7185',
    info: '#a78bfa',
    focusRing: 'rgba(34, 211, 238, 0.55)',
    onPrimary: '#020617',
    accent: '#c084fc'
  },
  radii,
  spacing,
  typography
};
