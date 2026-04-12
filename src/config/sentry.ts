// @ts-nocheck
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = Constants.expoConfig?.extra?.sentryDsn
  || process.env.EXPO_PUBLIC_SENTRY_DSN
  || null;

let initialised = false;

export function initSentry() {
  if (initialised || !DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableAutoSessionTracking: true,
  });
  initialised = true;
}

export function captureException(error, context) {
  if (!initialised) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message, level = 'info') {
  if (!initialised) return;
  Sentry.captureMessage(message, level);
}

export { Sentry };
