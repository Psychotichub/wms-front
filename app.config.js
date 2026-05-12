const fs = require('fs');
const path = require('path');

// Expo automatically injects EXPO_PUBLIC_* variables at build time
const apiUrl = process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_URL_DEV ||
  null;

const projectRoot = __dirname;
const googleServicesJson = path.join(projectRoot, 'google-services.json');
const googleServiceInfoPlist = path.join(projectRoot, 'GoogleService-Info.plist');
/** React Native Firebase's config plugin adds the Google Services Gradle plugin (classpath + apply) at prebuild — same as Firebase Android setup docs, but automated. It requires BOTH files because the plugin configures iOS too. */
const hasFirebaseNativeConfig =
  fs.existsSync(googleServicesJson) && fs.existsSync(googleServiceInfoPlist);

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
        ? { googleServicesFile: './GoogleService-Info.plist' }
        : {})
    },
    android: {
      package: 'com.psychotic.wms',
      ...(hasFirebaseNativeConfig
        ? { googleServicesFile: './google-services.json' }
        : {})
    }
  }
};
