// Expo automatically injects EXPO_PUBLIC_* variables at build time
// No dotenv needed - Expo handles this for dev builds
const apiUrl = process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_URL_DEV ||
  null;
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || null;
const googleMapsMapId = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || null;

module.exports = {
  expo: {
    name: 'WMS',
    slug: 'working-management-system',
    owner: 'e-wms',
    version: '1.0.0',
    icon: './assets/logo.png',
    platforms: ['ios', 'android', 'web'],
    web: {
      favicon: './assets/logo.png',
      name: 'working-management-system',
      shortName: 'WMS',
      lang: 'en',
      scope: '/',
      themeColor: '#007AFF',
      description: 'Working Management System for efficient project and employee management',
      // PWA settings
      orientation: 'portrait',
      display: 'standalone',
      startUrl: '/',
      backgroundColor: '#ffffff'
    },
    updates: {
      url: 'https://u.expo.dev/d1f4d263-2161-4968-a6eb-0a7f8de630f7'
    },
    runtimeVersion: '1.0.0',
    extra: {
      apiUrl,
      googleMapsApiKey,
      googleMapsMapId,
      eas: {
        projectId: 'd1f4d263-2161-4968-a6eb-0a7f8de630f7'
      }
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Allow WMS to access your location even when the app is closed to enable automatic attendance tracking.',
          locationAlwaysPermission: 'Allow WMS to access your location even when the app is closed to enable automatic attendance tracking.',
          locationWhenInUsePermission: 'Allow WMS to access your location to enable attendance tracking.',
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true
        }
      ]
    ],
    ios: {
      bundleIdentifier: 'com.psychotic.wms',
      infoPlist: {
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Allow WMS to access your location even when the app is closed to enable automatic attendance tracking.',
        NSLocationAlwaysUsageDescription: 'Allow WMS to access your location even when the app is closed to enable automatic attendance tracking.',
        NSLocationWhenInUseUsageDescription: 'Allow WMS to access your location to enable attendance tracking.',
        UIBackgroundModes: ['location'],
        // Google Maps API Key for iOS (set via environment variable)
        GMSApiKey: googleMapsApiKey || ''
      },
      config: {
        // Google Maps SDK configuration
        googleMapsApiKey: googleMapsApiKey || ''
      }
    },
    android: {
      package: 'com.psychotic.wms',
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION'
      ]
    },
    // Note: native config is managed directly in the android/ios folders.
    // When native folders exist, EAS Build won't sync plugins/ios/android from this file.
    // This is expected behavior - we manage native code manually for custom configurations.
  }
};

