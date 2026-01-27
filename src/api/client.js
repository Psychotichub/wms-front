import { buildUrl } from '../utils/apiUrl';

export const REQUEST_TIMEOUT_MS = 15000;

const isAuthEndpoint = (path) =>
  typeof path === 'string' &&
  (path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/signup') ||
    path.startsWith('/api/auth/refresh') ||
    path.startsWith('/api/auth/logout'));

export const createApiClient = ({
  apiUrl,
  waitForAuthReady,
  waitForRefreshInFlight,
  getToken,
  getRefreshToken,
  refreshAccessToken,
  logout,
  logError,
  isDev
}) => {
  const request = async (path, options = {}, retryCount = 0) => {
    // Block until auth hydration is complete to avoid using stale token and
    // to prevent components from making requests before auth state is known.
    if (waitForAuthReady) {
      await waitForAuthReady();
    }

    // If a refresh is in progress, queue this request until it finishes
    if (waitForRefreshInFlight) {
      await waitForRefreshInFlight();
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const currentToken = getToken ? getToken() : null;
    if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`;
    }

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const requestUrl = buildUrl(apiUrl, path);
      
      // Prepare request body - stringify if it's an object and Content-Type is JSON
      let requestBody = options.body;
      if (requestBody && typeof requestBody === 'object' && !(requestBody instanceof FormData) && !(requestBody instanceof Blob)) {
        // Only stringify if Content-Type is JSON (default)
        if (headers['Content-Type']?.includes('application/json')) {
          requestBody = JSON.stringify(requestBody);
        }
      }
      
      const response = await fetch(requestUrl, {
        ...options,
        body: requestBody,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle different response types
      let data;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        try {
          // Read as text first to check for HTML (response can only be read once)
          const text = await response.text();
          const isHtmlResponse = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
          
          if (isHtmlResponse && response.ok) {
            const errorMsg = 
              'API request returned HTML instead of JSON. ' +
              'This usually means the API URL is not configured correctly or the backend server is not running. ' +
              `Current API URL: ${apiUrl || 'not set'}`;
            
            const error = new Error(errorMsg);
            error.status = response.status;
            error.data = { contentType, isHtmlResponse: true };
            throw error;
          }
          
          // Parse as JSON if not HTML
          data = JSON.parse(text);
        } catch (parseError) {
          if (parseError.status) {
            // Re-throw our custom HTML error
            throw parseError;
          }
          
          if (isDev) {
            console.error('❌ JSON parse error:', parseError);
            console.error('Response status:', response.status);
            console.error('Content-Type:', contentType);
          }
          data = {};
        }
      } else {
        const text = await response.text().catch(() => '');
        
        // Detect HTML responses (usually means hitting frontend instead of backend)
        const isHtmlResponse = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
        
        if (isHtmlResponse && response.ok) {
          const errorMsg = 
            'API request returned HTML instead of JSON. ' +
            'This usually means the API URL is not configured correctly or the backend server is not running. ' +
            `Current API URL: ${apiUrl || 'not set'}`;
          
          const error = new Error(errorMsg);
          error.status = response.status;
          error.data = { contentType, isHtmlResponse: true };
          throw error;
        }
        
        if (isDev && contentType) {
          console.warn('⚠️ Non-JSON response:', contentType, text.substring(0, 100));
        }
        data = text;
      }

      if (!response.ok) {
        // Handle specific HTTP status codes with user-friendly messages
        let errorMessage = data.message || 'Request failed';

        switch (response.status) {
          case 400:
            // Include validation errors if available
            if (isDev) {
              console.error('❌ 400 Bad Request - Full response:', {
                status: response.status,
                data: data,
                hasErrors: !!(data.errors && Array.isArray(data.errors)),
                errorCount: data.errors?.length || 0,
                message: data.message,
                error: data.error
              });
            }
            if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
              const validationErrors = data.errors.map(e => `${e.field}: ${e.message}`).join(', ');
              errorMessage = `${data.message || 'Validation failed'}: ${validationErrors}`;
              if (isDev) {
                console.error('❌ Validation errors:', data.errors);
                data.errors.forEach((err, idx) => {
                  console.error(`  [${idx}] Field: ${err.field}, Message: ${err.message}`);
                });
              }
            } else if (data.error) {
              errorMessage = data.error;
            } else {
              errorMessage = data.message || 'Invalid request. Please check your input.';
            }
            break;
          case 401: {
            // Preserve backend message (e.g. "Invalid credentials") when present
            errorMessage = data.message || 'Authentication required. Please log in again.';
            // Don't log 401 errors to console if user is not authenticated (expected behavior)
            const isAuthPath = isAuthEndpoint(path);
            const hadToken = Boolean(getToken && getToken());
            // Only suppress console errors for 401s on protected routes when not authenticated
            const shouldSuppress401Log =
              options.__suppress401Log ||
              (typeof path === 'string' && path.startsWith('/api/notifications'));
            if (!isAuthPath && !hadToken && isDev) {
              // Suppress expected 401 errors when not logged in
              // These are normal and don't need to be logged
            } else if ((!isAuthPath || hadToken) && !shouldSuppress401Log) {
              if (logError) {
                await logError({
                  message: `401 error on ${path}: ${errorMessage}`,
                  level: 'warn',
                  context: 'AuthContext.request',
                  apiUrl,
                  extra: { path, status: response.status }
                });
              }
            }
            break;
          }
          case 403:
            errorMessage = 'Access denied. You may not have permission for this action.';
            break;
          case 404:
            errorMessage = 'Service not found. Please try again later.';
            break;
          case 408:
          case 504:
            errorMessage = 'Request timed out. Please check your connection and try again.';
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = data.message || 'Server error. Please try again later.';
            if (logError) {
              await logError({
                message: `Server error (${response.status}) on ${path}`,
                level: 'error',
                context: 'AuthContext.request',
                apiUrl,
                extra: { path, status: response.status, data }
              });
            }
            break;
          default:
            if (response.status >= 500) {
              errorMessage = data.message || 'Server error. Please try again later.';
              if (logError) {
                await logError({
                  message: `Server error (${response.status}) on ${path}`,
                  level: 'error',
                  context: 'AuthContext.request',
                  apiUrl,
                  extra: { path, status: response.status, data }
                });
              }
            }
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        error.response = { status: response.status, data };
        throw error;
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.status === 401) {
        // Only treat 401 as "session expired" for protected endpoints.
        // Login/signup can legitimately return 401 for invalid credentials.
        const isAuthPath = isAuthEndpoint(path);

        const hadToken = Boolean(getToken && getToken());
        const canRefresh = Boolean(getRefreshToken && getRefreshToken());

        // Try refresh once for protected endpoints when we had an access token and a refresh token
        if (!isAuthPath && hadToken && canRefresh && !options.__didRefresh) {
          try {
            if (refreshAccessToken) {
              await refreshAccessToken();
            }
            return request(path, { ...options, __didRefresh: true }, retryCount);
          } catch (refreshErr) {
            if (logout) {
              await logout();
            }
            throw new Error(refreshErr.message || 'Your session has expired. Please log in again.');
          }
        }

        if (!isAuthPath && hadToken && !canRefresh) {
          if (logout) {
            await logout();
          }
          throw new Error('Your session has expired. Please log in again.');
        }

        // For auth endpoints or when no token exists, propagate the original message.
        throw error;
      }

      // Handle network-specific errors
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }

      if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
        throw new Error('Network connection failed. Please check your internet connection and try again.');
      }

      // Re-throw custom errors with status codes
      if (error.status) {
        throw error;
      }

      // Retry logic for network errors (max 2 retries)
      const isRetryableError =
        error.message.includes('Network connection failed') ||
        error.message.includes('Request timed out') ||
        error.name === 'TypeError' ||
        (error.status >= 500 && error.status < 600);

      if (isRetryableError && retryCount < 2) {
        if (isDev) {
          console.warn(`Request failed, retrying... (${retryCount + 1}/2)`, error.message);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return request(path, options, retryCount + 1);
      }

      // Handle other unexpected errors
      if (logError) {
        await logError({
          error,
          level: 'error',
          context: 'AuthContext.request',
          apiUrl,
          extra: { path }
        });
      }
      throw new Error('An unexpected error occurred. Please try again.');
    }
  };

  return { request };
};
