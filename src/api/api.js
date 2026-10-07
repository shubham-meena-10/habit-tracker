// import { CONFIG, isApiConfigured } from '../config';
import { CONFIG, getApiToken, isApiConfigured } from '../config';

/**
 * kind:
 *  network – offline, timeout, DNS         (retry)
 *  server  – 5xx / BUSY                    (retry)
 *  invalid – non-JSON response             (retry; usually a deployment problem)
 *  auth    – 401, wrong token              (stop, keep data)
 *  config  – URL/token not set             (stop, keep data)
 *  client  – 4xx validation/conflict       (permanent, do not retry)
 */
export class ApiError extends Error {
  constructor(message, { kind = 'server', code = 'ERROR', status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
  get retryable() {
    return this.kind === 'network' || this.kind === 'server' || this.kind === 'invalid';
  }
}

function kindFromStatus(status) {
  if (status === 401) return 'auth';
  if (status >= 500) return 'server';
  return 'client';
}

export function describeError(err) {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

/**
 * Central API client. Every call is a POST with a text/plain JSON body:
 * that is a CORS "simple request" (no preflight), which Apps Script can answer.
 * Resolves with `data` from the response envelope, or throws ApiError.
 */
export async function request(action, data = {}, { requestId, timeoutMs } = {}) {
  if (!isApiConfigured()) {
    throw new ApiError(
      'The app is not configured. Set VITE_GOOGLE_APPS_SCRIPT_URL and VITE_API_TOKEN in .env, then restart the dev server.',
      { kind: 'config', code: 'NOT_CONFIGURED' }
    );
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('You are offline.', { kind: 'network', code: 'OFFLINE' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || CONFIG.REQUEST_TIMEOUT_MS);

  try {
    let res;
    try {
      res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        // body: JSON.stringify({ token: CONFIG.API_TOKEN, action, requestId, data }),
         body: JSON.stringify({ token: getApiToken(), action, requestId, data }),
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new ApiError('The server took too long to respond.', { kind: 'network', code: 'TIMEOUT' });
      }
      throw new ApiError(
        'Could not reach the server. Check your connection and that the Apps Script deployment allows access for "Anyone".',
        { kind: 'network', code: 'NETWORK' }
      );
    }

    let body;
    try {
      body = await res.json();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new ApiError('The server took too long to respond.', { kind: 'network', code: 'TIMEOUT' });
      }
      throw new ApiError(
        'The server sent an unexpected response. Make sure the URL ends in /exec and the Web App is deployed with access set to "Anyone".',
        { kind: 'invalid', code: 'INVALID_RESPONSE' }
      );
    }
    if (!body || typeof body.ok !== 'boolean') {
      throw new ApiError('The server sent an unexpected response.', { kind: 'invalid', code: 'INVALID_RESPONSE' });
    }

    if (!body.ok) {
      const e = body.error || {};
      const status = Number(body.status) || 500;
      const message =
        status === 401
          ? 'The API token was rejected. VITE_API_TOKEN must match the token printed by generateApiToken().'
          : e.message || 'The server reported an error.';
      throw new ApiError(message, { kind: kindFromStatus(status), code: e.code || 'ERROR', status });
    }
    return body.data;
  } finally {
    clearTimeout(timer);
  }
}