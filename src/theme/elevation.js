import { Platform } from 'react-native';

const iosShadow = (height, opacity, radius) => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height },
  shadowOpacity: opacity,
  shadowRadius: radius
});

/** Cross-platform elevation tokens — spread into styles (iOS shadows, Android elevation, web boxShadow). */
export const elevation = {
  /** Lists, settings rows, small chrome */
  subtle: Platform.select({
    ios: iosShadow(2, 0.05, 4),
    android: { elevation: 1 },
    default: { boxShadow: '0px 2px 4px rgba(0,0,0,0.06)' }
  }),
  /** Buttons, headers, compact controls */
  low: Platform.select({
    ios: iosShadow(4, 0.06, 10),
    android: { elevation: 2 },
    default: { boxShadow: '0px 4px 10px rgba(0,0,0,0.10)' }
  }),
  /** Cards, tiles, panels */
  medium: Platform.select({
    ios: iosShadow(6, 0.08, 12),
    android: { elevation: 4 },
    default: { boxShadow: '0px 8px 16px rgba(0,0,0,0.12)' }
  }),
  /** Modals, floating emphasis */
  high: Platform.select({
    ios: iosShadow(8, 0.12, 16),
    android: { elevation: 6 },
    default: { boxShadow: '0px 12px 24px rgba(0,0,0,0.14)' }
  }),
  /** Dropdowns, popovers — stronger lift for stacking above overlays */
  popover: Platform.select({
    ios: iosShadow(10, 0.2, 20),
    android: { elevation: 20 },
    default: { boxShadow: '0px 10px 20px rgba(0,0,0,0.2)' }
  })
};
