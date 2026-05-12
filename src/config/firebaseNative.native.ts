/**
 * Native Firebase (Gradle Google Services on Android, plist on iOS).
 * Place `google-services.json` and `GoogleService-Info.plist` in `frontend/` and enable
 * the `@react-native-firebase/app` plugin (see `app.config.js`).
 */
export function initFirebaseNative(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-firebase/app').getApp();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-firebase/analytics');
  } catch {
    /* Expected until native prebuild includes Google Services and a dev client is rebuilt. */
  }
}
