import type AuthCache from './AuthCache';
import type Claims from './Claims';
import { logWarn } from './console';
import { type TokenResponse } from './oauthTypes';

/**
 * Read the login stored in localStorage, shared by all tabs of the app
 *
 * An invalid stored login is removed.
 */
export const readStoredLogin = (storageKey: string): AuthCache | null => {
  const stored = localStorage.getItem(storageKey);
  if (stored === null) {
    return null;
  }

  try {
    const json: unknown = JSON.parse(stored);
    validateCache(json);
    return json;
  } catch (e: unknown) {
    logWarn(
      'Stored login look invalid, resetting',
      e instanceof Error ? e.message : 'Unknown error',
      stored,
    );
    localStorage.removeItem(storageKey);
    return null;
  }
};

/**
 * Remove the stored login
 *
 * With `ownCache`, the stored login is only removed if it is still that login. Another tab may have
 * replaced it with a newer one in the meantime, which must not be thrown away.
 */
export const clearStoredLogin = (storageKey: string, ownCache?: AuthCache) => {
  if (ownCache !== undefined) {
    const stored = readStoredLogin(storageKey);
    if (
      stored !== null &&
      stored.tokenResponse.refresh_token !== ownCache.tokenResponse.refresh_token
    ) {
      return;
    }
  }
  localStorage.removeItem(storageKey);
};

/**
 * Run `callback` while no other tab of the app is refreshing tokens
 *
 * Refresh tokens are single-use when the provider rotates them, and replaying a used one can make
 * the provider revoke the whole grant, so tabs must never refresh concurrently.
 */
export const withRefreshLock = async <T>(
  storageKey: string,
  callback: () => Promise<T>,
): Promise<T> => {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) {
    return callback();
  }
  return await navigator.locks.request(`${storageKey}.refresh`, callback);
};

function validateCache(data: unknown): asserts data is AuthCache {
  if (
    typeof data !== 'object' ||
    data == null ||
    !('tokenResponse' in data) ||
    !('user' in data) ||
    !('expiresAt' in data)
  ) {
    throw new Error('Incomplete stored login');
  }
  const { tokenResponse, user, expiresAt } = data;

  validateTokenResponse(tokenResponse);
  validateClaims(user);
  if (typeof expiresAt !== 'number') {
    throw new Error('Invalid expiresAt');
  }
}

function validateTokenResponse(tokenResponse: unknown): asserts tokenResponse is TokenResponse {
  if (
    typeof tokenResponse !== 'object' ||
    tokenResponse == null ||
    !('access_token' in tokenResponse) ||
    typeof tokenResponse['access_token'] !== 'string' ||
    !('token_type' in tokenResponse) ||
    typeof tokenResponse['token_type'] !== 'string' ||
    !('expires_in' in tokenResponse) ||
    typeof tokenResponse['expires_in'] !== 'number' ||
    !('refresh_token' in tokenResponse) ||
    typeof tokenResponse['refresh_token'] !== 'string' ||
    !('scope' in tokenResponse) ||
    typeof tokenResponse['scope'] !== 'string'
  ) {
    throw new Error('Invalid cached tokenResponse');
  }
}

function validateClaims(userinfo: unknown): asserts userinfo is Claims {
  if (
    typeof userinfo !== 'object' ||
    userinfo == null ||
    !('sub' in userinfo) ||
    typeof userinfo['sub'] !== 'string'
  ) {
    throw new Error('Invalid userinfo');
  }

  // no other fields are guaranteed
}
