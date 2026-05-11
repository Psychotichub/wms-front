// @ts-nocheck
import { useEffect, useRef } from 'react';
import { getApiUrl } from '../config/runtime';

const PING_TIMEOUT_MS = 90000; // 90 seconds — enough for a Render cold start
const PING_PATH = '/health';

/**
 * Silently pings the backend on app startup to wake up the Render free-tier
 * server before the user attempts to sign up or log in. Fires once per
 * app session and never surfaces errors to the user.
 */
export const useBackendPing = () => {
  const hasPinged = useRef(false);

  useEffect(() => {
    if (hasPinged.current) return;
    hasPinged.current = true;

    let apiUrl: string;
    try {
      apiUrl = getApiUrl();
    } catch {
      // Config not ready — skip ping silently
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    const endpoint = `${apiUrl.replace(/\/+$/, '')}${PING_PATH}`;

    fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
    })
      .then(() => {
        clearTimeout(timeoutId);
        if (__DEV__) {
          console.log('✅ [ping] Backend is awake');
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Intentionally silenced — this is a best-effort wake-up call
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);
};
