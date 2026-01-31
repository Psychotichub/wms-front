import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { DrawerProvider } from '../drawer/DrawerProvider';
import { navigationRef } from './navigationRef';
import AuthStack from './AuthStack';
import AppStack from './AppStack';
import { getAllowedRouteNames } from './routeConfig';

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

const RootNavigator = () => {
  const { token, user, apiUrl, isAuthReady } = useAuth();
  const t = useThemeTokens();
  const navTheme = useNavTheme();
  const [initialNavState, setInitialNavState] = useState();
  const [navReady, setNavReady] = useState(false);
  const legacyClearedRef = useRef(false);
  const prevStorageKeyRef = useRef(null);

  const userId = user?.id || user?._id || user?.email || null;
  const storageKey = useMemo(() => {
    if (!token || !userId) return null;
    const safeApi = (apiUrl || 'default').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    return `nav_state:${safeApi}:${userId}`;
  }, [apiUrl, token, userId]);

  const role = user?.role || 'user';
  const allowedRoutes = useMemo(() => getAllowedRouteNames(role), [role]);

  const getActiveRouteName = (state) => {
    if (!state || !state.routes || state.routes.length === 0) return null;
    const route = state.routes[state.index ?? 0];
    if (route.state) {
      return getActiveRouteName(route.state);
    }
    return route.name;
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
        setInitialNavState(storedState ? JSON.parse(storedState) : undefined);
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
    
    // Only reset to Login if there's no token AND no user
    // If user exists (even if not verified), allow navigation within AuthStack
    // This allows navigation to EmailVerification after signup
    // IMPORTANT: Don't reset if user exists - this allows navigation to EmailVerification
    if (!token && !user) {
      // Only reset if we're not currently navigating
      // Check current route to avoid interfering with navigation
      const currentRoute = navigationRef.current?.getCurrentRoute?.();
      const isOnAuthScreen = currentRoute?.name === 'Signup' || 
                             currentRoute?.name === 'EmailVerification' || 
                             currentRoute?.name === 'Login';
      
      // Only reset if we're not on an auth screen (prevents interfering with navigation)
      if (!isOnAuthScreen) {
        setInitialNavState(undefined);
        if (navigationRef.current?.resetRoot) {
          navigationRef.current.resetRoot({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    }
  }, [isAuthReady, navReady, token, user]);

  // Debug logging
  useEffect(() => {
    console.log('📱 RootNavigator state:', { isAuthReady, navReady, hasToken: !!token });
  }, [isAuthReady, navReady, token]);

  if (!isAuthReady || !navReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: t?.colors?.background || '#f7f9fb' 
      }}>
        <ActivityIndicator size="large" color={t?.colors?.primary || '#007AFF'} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      initialState={initialNavState}
      onStateChange={async (state) => {
        const activeRoute = getActiveRouteName(state);
        
        // Only check allowed routes if user has token and is verified
        if (token && user?.isEmailVerified && activeRoute && !allowedRoutes.includes(activeRoute)) {
          if (navigationRef.current?.resetRoot) {
            navigationRef.current.resetRoot({ index: 0, routes: [{ name: 'Access Denied' }] });
          }
          return;
        }
        
        // Persist navigation state only for verified users with tokens
        if (storageKey) {
          try {
            await AsyncStorage.setItem(storageKey, JSON.stringify(state));
          } catch {
            // ignore persistence errors
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
  );
};

export default RootNavigator;
