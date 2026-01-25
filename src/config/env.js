import Constants from 'expo-constants';

const DEFAULT_HINT = 'Set EXPO_PUBLIC_* variable in .env file and rebuild dev client.';

const normalizeValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return String(value);
  return value.trim();
};

const getEnvValue = (name) => {
  // Expo injects EXPO_PUBLIC_* variables into process.env at build time
  // Check process.env first (works in both Expo Go and dev builds)
  let value = normalizeValue(process.env[name]);
  
  // Fallback to expo config extra (from app.config.js)
  if (!value) {
    const configKey = name.replace('EXPO_PUBLIC_', '').toLowerCase();
    const configExtra = Constants.expoConfig?.extra || {};
    value = normalizeValue(configExtra[configKey]);
  }
  
  return value;
};

const requireEnv = (name, hint = DEFAULT_HINT) => {
  const value = getEnvValue(name);
  if (!value) {
    throw new Error(`[env] Missing ${name}. ${hint}`);
  }
  return value;
};

const getAppEnv = () => {
  const value = getEnvValue('EXPO_PUBLIC_APP_ENV') || process.env.NODE_ENV || 'development';
  return String(value).toLowerCase();
};

const getApiUrlEnv = () => {
  const appEnv = getAppEnv();
  const isProdEnv = appEnv === 'production';
  
  // Try multiple sources
  let apiUrl = 
    getEnvValue('EXPO_PUBLIC_API_URL') ||
    getEnvValue(isProdEnv ? 'EXPO_PUBLIC_API_URL_PROD' : 'EXPO_PUBLIC_API_URL_DEV');
  
  // Fallback to Constants.expoConfig.extra.apiUrl if available
  if (!apiUrl) {
    apiUrl = normalizeValue(Constants.expoConfig?.extra?.apiUrl);
  }
  
  return apiUrl;
};

const requireApiUrlEnv = () => {
  const appEnv = getAppEnv();
  const isProdEnv = appEnv === 'production';
  const fallbackName = isProdEnv ? 'EXPO_PUBLIC_API_URL_PROD' : 'EXPO_PUBLIC_API_URL_DEV';
  const value = getApiUrlEnv();
  if (!value) {
    throw new Error(
      `[env] Missing API base URL. Set EXPO_PUBLIC_API_URL or ${fallbackName} in .env or app.config.js and restart Expo.`
    );
  }
  return value;
};

const getGoogleMapsApiKeyEnv = () => {
  const appEnv = getAppEnv();
  const isProdEnv = appEnv === 'production';
  return (
    getEnvValue('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY') ||
    getEnvValue(isProdEnv ? 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_PROD' : 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEV')
  );
};

const requireGoogleMapsApiKeyEnv = () => {
  const appEnv = getAppEnv();
  const isProdEnv = appEnv === 'production';
  const fallbackName = isProdEnv ? 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_PROD' : 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEV';
  const value = getGoogleMapsApiKeyEnv();
  if (!value) {
    throw new Error(
      `[env] Missing Google Maps API key. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY or ${fallbackName} in .env or app.config.js and restart Expo.`
    );
  }
  return value;
};

const getAdminSignupCode = () => getEnvValue('EXPO_PUBLIC_ADMIN_SIGNUP_CODE');

const getWebPushVapidPublicKey = () => getEnvValue('EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY');

const requireWebPushVapidPublicKey = () =>
  requireEnv(
    'EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY',
    'Required for web push notifications. Add it to .env or app.config.js and restart Expo.'
  );

const validatePublicEnv = (options = {}) => {
  const { requireGoogleMapsKey = false, requireWebPushKey = false } = options;
  
  // Use getApiUrlEnv instead of requireApiUrlEnv to allow fallbacks
  const apiUrl = getApiUrlEnv();
  if (!apiUrl) {
    // Fail fast with clear error message
    const errorMsg = '[env] Missing API base URL. Set EXPO_PUBLIC_API_URL in .env file and rebuild dev client with: npx expo run:android';
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }
  
  if (requireGoogleMapsKey) {
    requireGoogleMapsApiKeyEnv();
  }
  if (requireWebPushKey) {
    requireWebPushVapidPublicKey();
  }
};

module.exports = {
  getAppEnv,
  getApiUrlEnv,
  requireApiUrlEnv,
  getGoogleMapsApiKeyEnv,
  requireGoogleMapsApiKeyEnv,
  getAdminSignupCode,
  getWebPushVapidPublicKey,
  requireWebPushVapidPublicKey,
  validatePublicEnv,
};
