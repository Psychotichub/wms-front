import { useWindowDimensions } from 'react-native';

/**
 * Responsive buckets for layout (mobile-first).
 * compact: under 480px; medium: 480–959; wide: 960+ (tablet / web).
 */
export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const medium = width >= 480 && width < 960;
  const wide = width >= 960;
  const breakpoint = wide ? 'wide' : medium ? 'medium' : 'compact';
  return { width, compact, medium, wide, breakpoint };
}

export default useBreakpoint;
