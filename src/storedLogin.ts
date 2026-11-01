import * as v from 'valibot';
import type AuthCache from './AuthCache';
import { ClaimsSchema } from './Claims';
import { logWarn } from './console';
import { TokenResponseSchema } from './oauthTypes';

const AuthCacheSchema = v.object({
  tokenResponse: v.object({
    ...TokenResponseSchema.entries,
    expires_in: v.number(),
    refresh_token: v.string(),
    scope: v.string(),
  }),
  user: ClaimsSchema,
  expiresAt: v.number(),
});

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
    return v.parse(AuthCacheSchema, JSON.parse(stored));
  } catch (e: unknown) {
    let reason = 'Unknown error';
    if (v.isValiError(e)) {
      reason = v.summarize(e.issues);
    } else if (e instanceof Error) {
      reason = e.message;
    }
    logWarn('Stored login look invalid, resetting', reason, stored);
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
