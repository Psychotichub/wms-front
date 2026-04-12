import type { NavigationState, PartialState } from '@react-navigation/routers';

type NavState = NavigationState | PartialState<NavigationState> | undefined;

/** Deep active route name (nested navigators). */
export function selectActiveRouteName(state: NavState): string | undefined {
  if (!state || !('routes' in state) || !state.routes?.length) return undefined;
  const idx = state.index ?? 0;
  const route = state.routes[idx] as { name?: string; state?: NavState };
  if (route?.state) {
    const nested = selectActiveRouteName(route.state);
    if (nested) return nested;
  }
  return route?.name;
}
