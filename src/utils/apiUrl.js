import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getApiUrl } from '../config/runtime';

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const buildUrl = (base, path = '') => {
  const normalizedBase = (base || '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

export const resolveApiUrl = ({
  apiUrlFromConfig,
  platform = Platform.OS,
  windowRef = typeof window !== 'undefined' ? window : undefined,
  dev = isDev
} = {}) => {
  // Use provided API URL or get from runtime config (fails fast if missing)
  // No silent fallbacks - must be explicitly configured
  const apiUrl = apiUrlFromConfig || getApiUrl();
  
  // Detect if running in Expo tunnel mode (HTTPS) for web
  const hasWindow = Boolean(windowRef && windowRef.location);
  if (platform === 'web' && hasWindow && apiUrl.startsWith('http://')) {
    const protocol = windowRef.location.protocol;
    const hostname = windowRef.location.hostname;
    const isTunnelMode = protocol === 'https:' && hostname && hostname.includes('exp.direct');
    
    if (isTunnelMode && dev) {
      console.warn('⚠️  Tunnel mode detected - backend API must be HTTPS');
      console.warn('💡 Solutions:');
      console.warn('   1. Use LAN mode: npx expo start --lan');
      console.warn('   2. Use ngrok for backend: ngrok http 4000');
      console.warn('   3. Set EXPO_PUBLIC_API_URL to ngrok HTTPS URL');
    }
  }

  return apiUrl;
};
