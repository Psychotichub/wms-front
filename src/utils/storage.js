import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

// MMKV is native-only; require lazily to keep web bundle safe.
let mmkvInstance = null;
if (!isWeb) {
  try {
    // eslint-disable-next-line global-require
    const { MMKV } = require('react-native-mmkv');
    mmkvInstance = new MMKV();
  } catch {
    mmkvInstance = null;
  }
}

export const kvStorage = {
  getItem: async (key) => {
    if (mmkvInstance) return mmkvInstance.getString(key) ?? null;
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (mmkvInstance) {
      mmkvInstance.set(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (mmkvInstance) {
      mmkvInstance.delete(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  }
};

export const secureStorage = {
  getItem: async (key) => {
    if (isWeb) return await AsyncStorage.getItem(key);
    try {
      const available = await SecureStore.isAvailableAsync();
      if (!available) return await AsyncStorage.getItem(key);
      return await SecureStore.getItemAsync(key);
    } catch {
      return await AsyncStorage.getItem(key);
    }
  },
  setItem: async (key, value) => {
    if (isWeb) return await AsyncStorage.setItem(key, value);
    try {
      const available = await SecureStore.isAvailableAsync();
      if (!available) return await AsyncStorage.setItem(key, value);
      return await SecureStore.setItemAsync(key, value);
    } catch {
      return await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key) => {
    if (isWeb) return await AsyncStorage.removeItem(key);
    try {
      const available = await SecureStore.isAvailableAsync();
      if (!available) return await AsyncStorage.removeItem(key);
      return await SecureStore.deleteItemAsync(key);
    } catch {
      return await AsyncStorage.removeItem(key);
    }
  }
};

export const getStorageKeysForApi = (baseUrl) => {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '');
  return {
    tokenKey: `wms_token:${normalizedBase}`,
    userKey: `wms_user:${normalizedBase}`,
    refreshKey: `wms_refresh:${normalizedBase}`,
    legacyTokenKey: 'wms_token',
    legacyUserKey: 'wms_user',
    legacyRefreshKey: 'wms_refresh'
  };
};

export const migrateSecureStoreKeyFromAsyncStorage = async (key) => {
  if (isWeb) return;
  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return;
    const secureVal = await SecureStore.getItemAsync(key);
    if (secureVal != null) return;
    const legacyVal = await AsyncStorage.getItem(key);
    if (legacyVal == null) return;
    await SecureStore.setItemAsync(key, legacyVal);
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore migration errors
  }
};


