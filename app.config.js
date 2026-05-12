const fs = require('fs');
const path = require('path');

// Expo automatically injects EXPO_PUBLIC_* variables at build time
const apiUrl = process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_URL_DEV ||
  null;

const projectRoot = __dirname;

/**
 * Firebase native files for @react-native-firebase/app (prebuild / Gradle + iOS plist).
 *
 * EAS Build: upload as File-type env vars (secret or sensitive) so gitignored files exist on the worker:
 *   - GOOGLE_SERVICES_JSON → your google-services.json
 *   - GOOGLE_SERVICES_PLIST → your GoogleService-Info.plist
 * Create in Expo dashboard (Environment variables) or: eas env:create --name GOOGLE_SERVICES_JSON --type file ...
 * Assign each variable to the same EAS environment(s) you build with (development / preview / production).
 *
 * Local: place ./google-services.json and ./GoogleService-Info.plist in this folder.
 */
function resolveFirebaseServicesPath(envAbsolutePath, localRelative) {
  if (envAbsolutePath) {
    return envAbsolutePath;
  }
  const localAbs = path.join(projectRoot, localRelative.replace(/^\.\//, ''));
  return fs.existsSync(localAbs) ? localRelative : undefined;
}

const androidGoogleServicesFile = resolveFirebaseServicesPath(
  process.env.GOOGLE_SERVICES_JSON,
  './google-services.json'
);
const iosGoogleServicesFile = resolveFirebaseServicesPath(
  process.env.GOOGLE_SERVICES_PLIST,
  './GoogleService-Info.plist'
);

const hasFirebaseNativeConfig = !!(androidGoogleServicesFile && iosGoogleServicesFile);

const adminSignupCode = process.env.EXPO_PUBLIC_ADMIN_SIGNUP_CODE || null;
const webPushVapidPublicKey = process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || null;

module.exports = {
  expo: {
    name: 'WMS',
    slug: 'working-management-system',
    owner: 'e-wms',
    version: '1.0.0',
    icon: './assets/logo.png',
    platforms: ['ios', 'android', 'web'],
    web: {
      // Single-page export: one index.html + client routing (EAS Hosting + Render static)
      output: 'single',
      favicon: './assets/logo.png',
      name: 'working-management-system',
      shortName: 'WMS',
      lang: 'en',
      scope: '/',
      themeColor: '#0891b2',
      description: 'Working Management System for efficient project and employee management',
      orientation: 'portrait',
      display: 'standalone',
      startUrl: '/',
      backgroundColor: '#020617'
    },
    updates: {
      url: 'https://u.expo.dev/d1f4d263-2161-4968-a6eb-0a7f8de630f7'
    },
    runtimeVersion: '1.0.0',
    extra: {
      apiUrl,
      adminSignupCode,
      webPushVapidPublicKey,
      eas: {
        projectId: 'd1f4d263-2161-4968-a6eb-0a7f8de630f7'
      }
    },
    plugins: [
      'expo-font',
      'expo-localization',
      '@sentry/react-native',
      ...(hasFirebaseNativeConfig ? ['@react-native-firebase/app'] : [])
    ],
    ios: {
      bundleIdentifier: 'com.psychotic.wms',
      ...(hasFirebaseNativeConfig
        ? { googleServicesFile: iosGoogleServicesFile }
        : {})
    },
    android: {
      package: 'com.psychotic.wms',
      ...(hasFirebaseNativeConfig
        ? { googleServicesFile: androidGoogleServicesFile }
        : {})
    }
  }
};
