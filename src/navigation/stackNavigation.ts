// @ts-nocheck
import { CommonActions } from '@react-navigation/native';
import { MAIN_TAB_ROUTE_NAMES } from './routeConfig';

function readMainTabsSnapshot(rootState) {
  const defaultRoutes = MAIN_TAB_ROUTE_NAMES.map((name) => ({ name }));
  const main = rootState?.routes?.find((r) => r.name === 'MainTabs');
  if (!main?.state?.routes?.length) {
    return { routes: defaultRoutes, index: 0 };
  }
  const prevParamsByName = {};
  for (const r of main.state.routes) {
    if (r?.name && r.params && typeof r.params === 'object' && Object.keys(r.params).length > 0) {
      prevParamsByName[r.name] = r.params;
    }
  }
  const routes = MAIN_TAB_ROUTE_NAMES.map((name) =>
    prevParamsByName[name] ? { name, params: prevParamsByName[name] } : { name }
  );
  const idx = Math.min(Math.max(0, main.state.index ?? 0), routes.length - 1);
  return { routes, index: idx };
}

/**
 * Replace the app stack with MainTabs (keeps your current tab) + one stack screen.
 * Back returns to that tab — avoids chains like MainTabs → Inventory → X without forcing Dashboard.
 */
export function resetRootToDashboardThenStackScreen(navigation, screenName, params) {
  if (!navigation?.dispatch) return;
  const hasParams =
    params !== undefined && params !== null && typeof params === 'object' && Object.keys(params).length > 0;
  const secondRoute = hasParams ? { name: screenName, params } : { name: screenName };

  const rootState = navigation.getRootState?.();
  const tab = readMainTabsSnapshot(rootState);

  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [
        {
          name: 'MainTabs',
          state: {
            routes: tab.routes,
            index: tab.index
          }
        },
        secondRoute
      ]
    })
  );
}

/** Replace the app stack with only MainTabs, with a specific tab focused (and optional tab params). */
export function resetRootToMainTab(navigation, tabName, tabParams) {
  if (!navigation?.dispatch) return;
  const idx = MAIN_TAB_ROUTE_NAMES.indexOf(tabName);
  if (idx < 0) return;

  const hasTabParams =
    tabParams !== undefined &&
    tabParams !== null &&
    typeof tabParams === 'object' &&
    Object.keys(tabParams).length > 0;

  const routes = MAIN_TAB_ROUTE_NAMES.map((name) => {
    if (name === tabName && hasTabParams) {
      return { name, params: tabParams };
    }
    return { name };
  });

  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: { routes, index: idx }
        }
      ]
    })
  );
}
