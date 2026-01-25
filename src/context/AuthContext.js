import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { createApiClient } from '../api/client';
import { getStorageKeysForApi, migrateSecureStoreKeyFromAsyncStorage, secureStorage } from '../utils/storage';
import { logError } from '../utils/telemetry';
import { buildUrl, resolveApiUrl } from '../utils/apiUrl';

const AuthContext = createContext(null);

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const AuthProvider = ({ children }) => {
  const apiUrl = useMemo(() => resolveApiUrl(), []);
  const storageKeys = useMemo(() => getStorageKeysForApi(apiUrl), [apiUrl]);

  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (isDev) {
      console.log('🚀 API URL resolved:', apiUrl);
      console.log('📱 Platform:', Platform.OS);
    }
  }, [apiUrl]);

  // Debug auth ready state
  useEffect(() => {
    if (isDev) {
      console.log('🔐 Auth state:', { isAuthReady, hasToken: !!token, hasUser: !!user });
    }
  }, [isAuthReady, token, user]);

  const tokenRef = useRef(null);
  const refreshTokenRef = useRef(null);
  const userRef = useRef(null);
  const authReadyRef = useRef(false);
  const authReadyResolveRef = useRef(null);
  const authReadyPromiseRef = useRef(null);
  const refreshInFlightRef = useRef(null);

  if (!authReadyPromiseRef.current) {
    authReadyPromiseRef.current = new Promise((resolve) => {
      authReadyResolveRef.current = resolve;
    });
  }

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const waitForAuthReady = useCallback(async () => {
    if (!authReadyRef.current) {
      await authReadyPromiseRef.current;
    }
  }, []);

  const waitForRefreshInFlight = useCallback(async () => {
    if (refreshInFlightRef.current) {
      try {
        await refreshInFlightRef.current;
      } catch {
        // ignore here; request will handle 401/refresh again or fail
      }
    }
  }, []);

  const getToken = useCallback(() => tokenRef.current || token, [token]);
  const getRefreshToken = useCallback(() => refreshTokenRef.current || refreshToken, [refreshToken]);

  // Bootstrap auth from storage
  useEffect(() => {
    (async () => {
      try {
        await migrateSecureStoreKeyFromAsyncStorage(storageKeys.legacyTokenKey);
        await migrateSecureStoreKeyFromAsyncStorage(storageKeys.legacyUserKey);
        await migrateSecureStoreKeyFromAsyncStorage(storageKeys.legacyRefreshKey);

        // Prefer per-api storage keys to avoid cross-environment token reuse
        let storedToken = await secureStorage.getItem(storageKeys.tokenKey);
        let storedUser = await secureStorage.getItem(storageKeys.userKey);
        let storedRefresh = await secureStorage.getItem(storageKeys.refreshKey);
        
        if (isDev) {
          console.log('🔑 Storage lookup:', {
            tokenKey: storageKeys.tokenKey,
            hasToken: !!storedToken,
            hasUser: !!storedUser,
            hasRefresh: !!storedRefresh
          });
        }

        // Migrate legacy keys (older builds) into per-api keys once.
        if (!storedToken || !storedUser || !storedRefresh) {
          const legacyToken = await secureStorage.getItem(storageKeys.legacyTokenKey);
          const legacyUser = await secureStorage.getItem(storageKeys.legacyUserKey);
          const legacyRefresh = await secureStorage.getItem(storageKeys.legacyRefreshKey);
          if (legacyToken && legacyUser) {
            storedToken = legacyToken;
            storedUser = legacyUser;
            storedRefresh = legacyRefresh;
            await secureStorage.setItem(storageKeys.tokenKey, legacyToken);
            await secureStorage.setItem(storageKeys.userKey, legacyUser);
            if (legacyRefresh) {
              await secureStorage.setItem(storageKeys.refreshKey, legacyRefresh);
            }
            await secureStorage.removeItem(storageKeys.legacyTokenKey);
            await secureStorage.removeItem(storageKeys.legacyUserKey);
            await secureStorage.removeItem(storageKeys.legacyRefreshKey);
          }
        }

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          if (isDev) {
            console.log('✅ Loaded token and user from storage');
          }
        } else if (isDev) {
          console.log('⚠️  No stored token/user found');
        }
        if (storedRefresh) {
          setRefreshToken(storedRefresh);
        }
      } catch (err) {
        await logError({
          error: err,
          level: 'warn',
          context: 'AuthContext.bootstrap',
          apiUrl
        });
      } finally {
        authReadyRef.current = true;
        setIsAuthReady(true);
        if (authReadyResolveRef.current) {
          authReadyResolveRef.current();
        }
      }
    })();
  }, [apiUrl, storageKeys]);

  // Persist auth changes
  useEffect(() => {
    (async () => {
      try {
        // Prevent wiping storage before hydration completes
        if (!isAuthReady) {
          if (isDev) {
            console.log('⏳ Skipping persist - auth not ready yet');
          }
          return;
        }

        if (token && user) {
          await secureStorage.setItem(storageKeys.tokenKey, token);
          await secureStorage.setItem(storageKeys.userKey, JSON.stringify(user));
          if (refreshToken) {
            await secureStorage.setItem(storageKeys.refreshKey, refreshToken);
          } else {
            await secureStorage.removeItem(storageKeys.refreshKey);
          }
          if (isDev) {
            console.log('💾 Saved token and user to storage:', {
              tokenKey: storageKeys.tokenKey,
              hasToken: !!token,
              hasUser: !!user
            });
          }
        } else {
          await secureStorage.removeItem(storageKeys.tokenKey);
          await secureStorage.removeItem(storageKeys.userKey);
          await secureStorage.removeItem(storageKeys.refreshKey);
          if (isDev) {
            console.log('🗑️  Removed token and user from storage (logout/clear)');
          }
        }
      } catch (err) {
        await logError({
          error: err,
          level: 'warn',
          context: 'AuthContext.persist',
          apiUrl
        });
      }
    })();
  }, [apiUrl, token, refreshToken, user, isAuthReady, storageKeys]);

  const logout = useCallback(async () => {
    // Best-effort backend logout (revoke refresh token)
    try {
      const currentRefresh = refreshTokenRef.current;
      if (currentRefresh) {
        await fetch(buildUrl(apiUrl, '/api/auth/logout'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefresh })
        });
      }
    } catch {
      // ignore
    } finally {
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    }
  }, [apiUrl]);

  const refreshAccessToken = useCallback(async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const currentRefresh = refreshTokenRef.current;
    if (!currentRefresh) {
      throw new Error('Missing refresh token');
    }

    refreshInFlightRef.current = (async () => {
      const res = await fetch(buildUrl(apiUrl, '/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefresh })
      });

      const contentType = res.headers.get('content-type');
      const data =
        contentType && contentType.includes('application/json')
          ? await res.json().catch(() => ({}))
          : await res.text().catch(() => ({}));

      if (!res.ok) {
        const msg = (data && data.message) || 'Refresh failed';
        throw new Error(msg);
      }

      if (data.token) setToken(data.token);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
      if (data.user) setUser(data.user);
      // Ensure immediate retries use fresh values (avoid waiting for state→effect to update refs)
      if (data.token) tokenRef.current = data.token;
      if (data.refreshToken) refreshTokenRef.current = data.refreshToken;
      if (data.user) userRef.current = data.user;
      return data;
    })();

    try {
      return await refreshInFlightRef.current;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, [apiUrl]);
  const apiClient = useMemo(
    () =>
      createApiClient({
        apiUrl,
        waitForAuthReady,
        waitForRefreshInFlight,
        getToken,
        getRefreshToken,
        refreshAccessToken,
        logout,
        logError,
        isDev
      }),
    [
      apiUrl,
      waitForAuthReady,
      waitForRefreshInFlight,
      getToken,
      getRefreshToken,
      refreshAccessToken,
      logout
    ]
  );
  const request = apiClient.request;

  const login = useCallback(async (email, password, company) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, company, deviceType: Platform.OS })
      });
      
      if (isDev) {
        console.log('🔐 Login successful:', {
          hasToken: !!data.token,
          hasUser: !!data.user,
          hasRefreshToken: !!data.refreshToken
        });
      }
      
      // Validate that required fields are present
      if (!data || (!data.token && !data.user)) {
        throw new Error('Invalid login response: missing token or user data');
      }
      
      if (!data.token) {
        throw new Error('Login failed: no access token received');
      }
      
      if (!data.user) {
        throw new Error('Login failed: no user data received');
      }
      
      setToken(data.token);
      tokenRef.current = data.token;
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
        refreshTokenRef.current = data.refreshToken;
      }
      setUser(data.user);
      userRef.current = data.user;
      
      // Note: Token persistence happens automatically via the persist effect
      // which watches token, user, and isAuthReady state changes
      
      return true;
    } catch (err) {
      setError(err.message);
      if (isDev) {
        console.error('❌ Login failed:', err.message);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  const signup = useCallback(async (name, email, password, company, adminCode) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await request('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, company, adminCode })
      });
      setToken(data.token);
      tokenRef.current = data.token;
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
        refreshTokenRef.current = data.refreshToken;
      }
      setUser(data.user);
      userRef.current = data.user;
      return true;
    } catch (err) {
      // Provide user-friendly error messages
      let errorMessage = err.message;
      if (err.status === 500 || err.status === 503) {
        errorMessage = 'Server error. Please check if the backend is running and try again.';
      } else if (err.status === 400) {
        errorMessage = err.message || 'Invalid information. Please check your input and try again.';
      } else if (err.status === 503) {
        errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
      }
      setError(errorMessage);
      await logError({
        error: err,
        level: 'warn',
        context: 'AuthContext.signup',
        apiUrl
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, request]);

  const getSites = useCallback(async () => {
    const data = await request('/api/sites');
    return {
      sites: Array.isArray(data.sites) ? data.sites : [],
      activeSite: data.activeSite
    };
  }, [request]);

  const addSite = useCallback(async (site) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await request('/api/sites', {
        method: 'POST',
        body: JSON.stringify({ site })
      });
      if (data.token) {
        setToken(data.token);
        tokenRef.current = data.token;
      }
      const updatedUser = data.user || {
        ...(userRef.current || {}),
        sites: data.sites,
        site: data.activeSite
      };
      setUser(updatedUser);
      userRef.current = updatedUser;
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  const setActiveSite = useCallback(async (site) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await request('/api/sites/active', {
        method: 'PUT',
        body: JSON.stringify({ site })
      });
      setToken(data.token);
      tokenRef.current = data.token;
      setUser(data.user);
      userRef.current = data.user;
      return data.user;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  const value = useMemo(
    () => ({
      token,
      user,
      isLoading,
      error,
      isAuthReady,
      login,
      signup,
      logout,
      request,
      apiUrl,
      getSites,
      addSite,
      setActiveSite
    }),
    [token, user, isLoading, error, isAuthReady, login, signup, logout, request, apiUrl, getSites, addSite, setActiveSite]
  );

  // Gate rendering at provider level until auth hydration completes.
  if (!isAuthReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f9fb' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

