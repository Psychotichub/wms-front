import { Platform } from 'react-native';

const DEFAULT_ENDPOINT = '/api/telemetry/client-error';
const REQUEST_TIMEOUT_MS = 5000;

const normalizeBaseUrl = (baseUrl) => (baseUrl || '').replace(/\/+$/, '');

const toStringSafe = (value) => {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const logError = async ({
  error,
  message,
  level = 'error',
  context,
  extra,
  apiUrl
} = {}) => {
  const finalMessage = message || toStringSafe(error) || 'Unknown error';
  const stack = error instanceof Error ? error.stack : undefined;
  const name = error instanceof Error ? error.name : undefined;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const consoleFn = level === 'warn' ? console.warn : console.error;
    consoleFn('[telemetry]', finalMessage, { context, extra, name });
  }

  const endpoint = `${normalizeBaseUrl(apiUrl)}${DEFAULT_ENDPOINT}`;

  const payload = {
    message: finalMessage,
    name,
    stack,
    level,
    context,
    extra,
    platform: Platform.OS
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch {
    // Intentionally ignore telemetry failures
  } finally {
    clearTimeout(timeoutId);
  }
};
