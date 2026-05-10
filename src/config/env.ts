// @ts-nocheck
import Constants from 'expo-constants';

const DEFAULT_HINT = 'Set EXPO_PUBLIC_* variable in .env file and rebuild dev client.';

const normalizeValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return String(value);
  return value.trim();
};

const getEnvValue = (name) => {
  let value = normalizeValue(process.env[name]);

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

  let apiUrl =
    getEnvValue('EXPO_PUBLIC_API_URL') ||
    getEnvValue(isProdEnv ? 'EXPO_PUBLIC_API_URL_PROD' : 'EXPO_PUBLIC_API_URL_DEV');

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

const getAdminSignupCode = () => getEnvValue('EXPO_PUBLIC_ADMIN_SIGNUP_CODE');

const getWebPushVapidPublicKey = () => getEnvValue('EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY');

const requireWebPushVapidPublicKey = () =>
  requireEnv(
    'EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY',
    'Required for web push notifications. Add it to .env or app.config.js and restart Expo.'
  );

const validatePublicEnv = (options = {}) => {
  const { requireWebPushKey = false } = options;

  const apiUrl = getApiUrlEnv();
  if (!apiUrl) {
    const errorMsg =
      '[env] Missing API base URL. Set EXPO_PUBLIC_API_URL in .env file and rebuild dev client with: npx expo run:android';
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }

  if (requireWebPushKey) {
    requireWebPushVapidPublicKey();
  }
};

export {
  getAppEnv,
  getApiUrlEnv,
  requireApiUrlEnv,
  getAdminSignupCode,
  getWebPushVapidPublicKey,
  requireWebPushVapidPublicKey,
  validatePublicEnv,
};
