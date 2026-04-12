// @ts-nocheck
import { baseColors, radii, spacing, typography, semanticStatusColors, chartColors } from './colors';

export const lightTheme = {
  mode: 'light',
  colors: {
    background: baseColors.gray50,
    surface: '#ffffff',
    card: '#ffffff',
    text: baseColors.gray800,
    textSecondary: baseColors.gray500,
    muted: baseColors.gray400,
    border: '#bae6fd',
    primary: baseColors.primary,
    success: baseColors.success,
    warning: baseColors.warning,
    danger: baseColors.danger,
    info: baseColors.info,
    focusRing: 'rgba(8, 145, 178, 0.45)',
    onPrimary: '#ffffff',
    accent: '#7c3aed',
    ...semanticStatusColors.light,
    ...chartColors.light
  },
  radii,
  spacing,
  typography
};
