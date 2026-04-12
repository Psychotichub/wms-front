// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import type { InitialState } from '@react-navigation/routers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { DrawerProvider } from '../drawer/DrawerProvider';
import { navigationRef } from './navigationRef';
import AuthStack from './AuthStack';
import AppStack from './AppStack';
import { getAllowedRouteNames, ROUTE_BREADCRUMB_LABELS } from './routeConfig';
import BreadcrumbBar from '../components/BreadcrumbBar';
const NAV_STATE_KEY = 'wms_nav_state';

const useNavTheme = () => {
  const t = useThemeTokens();
  return useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: t.colors.background,
        card: t.colors.card,
        text: t.colors.text,
        primary: t.colors.primary,
        border: t.colors.border
      }
    }),
    [t]
  );
};

function collectRouteChain(state: { routes: { name?: string; state?: unknown }[]; index?: number } | undefined): string[] {
  const names: string[] = [];
  const walk = (s: typeof state) => {
    if (!s?.routes?.length) return;
    const r = s.routes[s.index ?? 0];
    if (r?.state && typeof r.state === 'object') {
      walk(r.state as typeof state);
    }
    if (r?.name) names.push(r.name);
  };
  walk(state);
  return names;
}

function formatBreadcrumb(state: Parameters<typeof collectRouteChain>[0]): string {
  const names = collectRouteChain(state);
  return names.map((n) => ROUTE_BREADCRUMB_LABELS[n as keyof typeof ROUTE_BREADCRUMB_LABELS] || n).join(' / ');
}

const RootNavigator = () => {
  const { token, user, apiUrl, isAuthReady } = useAuth();
  const t = useThemeTokens();
  const navTheme = useNavTheme();
  const [initialNavState, setInitialNavState] = useState<InitialState | undefined>();
  const [navReady, setNavReady] = useState(false);
  const [breadcrumbText, setBreadcrumbText] = useState('');
  const legacyClearedRef = useRef(false);
  const prevStorageKeyRef = useRef<string | null>(null);

  const userId = user?.id || user?._id || user?.email || null;
  const storageKey = useMemo(() => {
    if (!token || !userId) return null;
    const safeApi = (apiUrl || 'default').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    return `nav_state:${safeApi}:${userId}`;
  }, [apiUrl, token, userId]);

  const role = user?.role || 'user';
  const allowedRoutes = useMemo(() => getAllowedRouteNames(role), [role]);

  const getActiveRouteName = (state: Parameters<typeof collectRouteChain>[0]): string | null => {
    if (!state || !state.routes || state.routes.length === 0) return null;
    const route = state.routes[state.index ?? 0];
    if (route.state) {
      return getActiveRouteName(route.state as typeof state);
    }
    return route.name ?? null;
  };

  useEffect(() => {
    if (!isAuthReady || legacyClearedRef.current) return;
    legacyClearedRef.current = true;
    AsyncStorage.removeItem(NAV_STATE_KEY).catch(() => {});
  }, [isAuthReady]);

  useEffect(() => {
    let isActive = true;
    const loadState = async () => {
      if (!isAuthReady) return;
      setNavReady(false);
      try {
        const storedState = storageKey ? await AsyncStorage.getItem(storageKey) : null;
        if (!isActive) return;
        setInitialNavState(storedState ? (JSON.parse(storedState) as InitialState) : undefined);
      } catch {
        if (!isActive) return;
        setInitialNavState(undefined);
      } finally {
        if (isActive) setNavReady(true);
      }
    };
    loadState();
    return () => {
      isActive = false;
    };
  }, [isAuthReady, storageKey]);

  useEffect(() => {
    const prevStorageKey = prevStorageKeyRef.current;
    prevStorageKeyRef.current = storageKey;
    if (prevStorageKey && !storageKey) {
      AsyncStorage.removeItem(prevStorageKey).catch(() => {});
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isAuthReady || !navReady) return;

    if (!token && !user) {
      const currentRoute = navigationRef.current?.getCurrentRoute?.();
      const isOnAuthScreen =
        currentRoute?.name === 'Signup' ||
        currentRoute?.name === 'EmailVerification' ||
        currentRoute?.name === 'Login';

      if (!isOnAuthScreen) {
        setInitialNavState(undefined);
        if (navigationRef.current?.resetRoot) {
          navigationRef.current.resetRoot({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    }
  }, [isAuthReady, navReady, token, user]);

  useEffect(() => {
    console.log('📱 RootNavigator state:', { isAuthReady, navReady, hasToken: !!token });
  }, [isAuthReady, navReady, token]);

  if (!isAuthReady || !navReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: t?.colors?.background || '#020617'
        }}
      >
        <ActivityIndicator size="large" color={t?.colors?.primary || '#22d3ee'} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {Platform.OS === 'web' ? <BreadcrumbBar text={breadcrumbText} /> : null}
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
        initialState={initialNavState}
        onStateChange={async (state) => {
          if (Platform.OS === 'web') {
            setBreadcrumbText(formatBreadcrumb(state as Parameters<typeof collectRouteChain>[0]));
          }
          const activeRoute = getActiveRouteName(state as Parameters<typeof collectRouteChain>[0]);

          if (token && user?.isEmailVerified && activeRoute && !allowedRoutes.includes(activeRoute)) {
            if (navigationRef.current?.resetRoot) {
              navigationRef.current.resetRoot({ index: 0, routes: [{ name: 'Access Denied' }] });
            }
            return;
          }

          if (storageKey) {
            try {
              await AsyncStorage.setItem(storageKey, JSON.stringify(state));
            } catch {
              /* ignore */
            }
          }
        }}
      >
        {token && user?.isEmailVerified ? (
          <DrawerProvider>
            <AppStack />
          </DrawerProvider>
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>
    </View>
  );
};

export default RootNavigator;
