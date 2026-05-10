// @ts-nocheck
import Constants from 'expo-constants';

const getConfig = (key) => {
  const configValue = Constants.expoConfig?.extra?.[key];
  if (configValue) {
    return String(configValue).trim();
  }

  const envKey = `EXPO_PUBLIC_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
  // eslint-disable-next-line
  const envValue = process.env[envKey];
  if (envValue) {
    return String(envValue).trim();
  }

  const errorMsg =
    `Missing required config: ${key}. ` +
    `Set ${envKey} in .env file and rebuild dev client with: npx expo run:android`;

  console.error('❌ Config Error:', errorMsg);
  throw new Error(errorMsg);
};

export const getApiUrl = () => {
  try {
    return getConfig('apiUrl');
  } catch (error) {
    console.error('❌ Config Error:', error.message);
    throw error;
  }
};

export const getOptionalConfig = (key) => {
  const configValue = Constants.expoConfig?.extra?.[key];
  if (configValue) {
    return String(configValue).trim();
  }

  const envKey = `EXPO_PUBLIC_${key.toUpperCase().replace(/-/g, '_')}`;
  // eslint-disable-next-line
  const envValue = process.env[envKey];
  if (envValue) {
    return String(envValue).trim();
  }

  return null;
};

export const getAdminSignupCode = () => getOptionalConfig('adminSignupCode');

export const getWebPushVapidPublicKey = () => getOptionalConfig('webPushVapidPublicKey');

export const validateRequiredConfig = (options = {}) => {
  const { requireWebPushKey = false } = options;

  getApiUrl();

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
