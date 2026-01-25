import Constants from 'expo-constants';

/**
 * Runtime configuration reader for Expo apps
 * 
 * This module enforces fail-fast behavior to prevent blank screens.
 * All config values must be explicitly set - no silent fallbacks.
 * 
 * Rules:
 * - Check Constants.expoConfig.extra first (from app.config.js)
 * - Fallback to process.env (Expo injects EXPO_PUBLIC_* at build time)
 * - Fail loudly if value is missing - never silently default
 */

const getConfig = (key) => {
  // Check Constants.expoConfig.extra first (from app.config.js)
  const configValue = Constants.expoConfig?.extra?.[key];
  if (configValue) {
    return String(configValue).trim();
  }
  
  // Fallback to process.env (Expo injects EXPO_PUBLIC_* at build time)
  const envKey = `EXPO_PUBLIC_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
  // Dynamic env key access is intentional for runtime config
  // eslint-disable-next-line
  const envValue = process.env[envKey];
  if (envValue) {
    return String(envValue).trim();
  }
  
  // Fail loudly - no silent fallbacks
  const errorMsg = 
    `Missing required config: ${key}. ` +
    `Set ${envKey} in .env file and rebuild dev client with: npx expo run:android`;
  
  console.error('❌ Config Error:', errorMsg);
  throw new Error(errorMsg);
};

/**
 * Get API URL - fails fast if missing
 * @throws {Error} If API URL is not configured
 */
export const getApiUrl = () => {
  try {
    return getConfig('apiUrl');
  } catch (error) {
    console.error('❌ Config Error:', error.message);
    throw error;
  }
};

/**
 * Get Google Maps API Key - fails fast if missing
 * @throws {Error} If Google Maps API key is not configured
 */
export const getGoogleMapsApiKey = () => {
  try {
    return getConfig('googleMapsApiKey');
  } catch (error) {
    console.error('❌ Config Error:', error.message);
    throw error;
  }
};

/**
 * Get optional config value (returns null if missing, doesn't throw)
 * Use only for truly optional configs
 */
export const getOptionalConfig = (key) => {
  const configValue = Constants.expoConfig?.extra?.[key];
  if (configValue) {
    return String(configValue).trim();
  }
  
  const envKey = `EXPO_PUBLIC_${key.toUpperCase().replace(/-/g, '_')}`;
  // Dynamic env key access is intentional for runtime config
  // eslint-disable-next-line
  const envValue = process.env[envKey];
  if (envValue) {
    return String(envValue).trim();
  }
  
  return null;
};

/**
 * Get Admin Signup Code (optional)
 */
export const getAdminSignupCode = () => getOptionalConfig('adminSignupCode');

/**
 * Get Web Push VAPID Public Key (optional)
 */
export const getWebPushVapidPublicKey = () => getOptionalConfig('webPushVapidPublicKey');

/**
 * Get Google Maps Map ID (optional)
 * Required for Advanced Markers. If not set, regular markers will be used.
 */
export const getGoogleMapsMapId = () => getOptionalConfig('googleMapsMapId');

/**
 * Validate that required configs are present
 * @throws {Error} If any required config is missing
 */
export const validateRequiredConfig = (options = {}) => {
  const { requireGoogleMapsKey = false, requireWebPushKey = false } = options;
  
  // API URL is always required
  getApiUrl();
  
  if (requireGoogleMapsKey) {
    getGoogleMapsApiKey();
  }
  
  if (requireWebPushKey) {
    const key = getWebPushVapidPublicKey();
    if (!key) {
      throw new Error(
        'Missing required config: webPushVapidPublicKey. ' +
        'Set EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY in .env and rebuild dev client.'
      );
    }
  }
};
