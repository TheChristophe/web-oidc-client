import { type AuthContext, type StateOf, type Transition, errorState } from './AuthMachineState';
import type AuthCache from '../AuthCache';
import * as v from 'valibot';
import { type WorkingTokenResponse, WorkingTokenResponseSchema } from '../oauthTypes';
import type Claims from '../Claims';
import { ClaimsSchema } from '../Claims';
import isJsonResponse from '../isJsonResponse';
import { readStoredLogin, withRefreshLock } from '../storedLogin';
import { logWarn } from '../console';
import REFRESH_WINDOW from '../refreshWindow';

type Context = AuthContext<'authCache' | 'endpoints'>;

const requestToken = async (context: Context, refresh_token: string): Promise<Response> =>
  fetch(context.endpoints.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      redirect_uri: context.configuration.redirectionUrl,
      client_id: context.configuration.clientId,
      // optional
      //scope: context.configuration.scopes,
    }),
  });

const requestUserinfo = async (context: Context, token: WorkingTokenResponse): Promise<Response> =>
  fetch(context.endpoints.userinfo_endpoint, {
    headers: { Authorization: `${token.token_type} ${token.access_token}` },
  });

const packTokenAndUser = (token: WorkingTokenResponse, user: Claims): AuthCache => ({
  tokenResponse: token,
  user,
  expiresAt: Date.now() + token.expires_in * 1000,
});

const refreshLocked = async (ownContext: Context): Transition => {
  let context = ownContext;

  // another tab may have refreshed or logged out while this one waited for the lock
  const stored = readStoredLogin(context.storageKey);
  if (stored === null) {
    return { type: 'not-logged-in', context };
  }
  if (stored.tokenResponse.refresh_token !== context.authCache.tokenResponse.refresh_token) {
    context = { ...context, authCache: stored };
    if (stored.expiresAt - Date.now() > REFRESH_WINDOW) {
      return { type: 'logged-in', context };
    }
  }

  const refreshToken = context.authCache.tokenResponse.refresh_token;
  if (refreshToken === undefined) {
    return { type: 'start-oauth', context };
  }

  let token: WorkingTokenResponse;
  let tokenResponse: Response;
  try {
    tokenResponse = await requestToken(context, refreshToken);
  } catch (error: unknown) {
    return errorState(context, 'Error while renewing token', error);
  }

  if (!tokenResponse.ok) {
    if (isJsonResponse(tokenResponse)) {
      const jason: unknown = await tokenResponse.json();
      if (
        tokenResponse.status === 400 &&
        typeof jason === 'object' &&
        jason !== null &&
        'error' in jason &&
        jason['error'] === 'invalid_grant'
      ) {
        // refresh token expired or invalidated, the user has to log in again
        // https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
        logWarn('Refresh token rejected, logging out', jason);
        return { type: 'not-logged-in', context };
      }
      // i am considering all other errors to be configuration errors or client bugs
      return errorState(context, 'Token response was not ok', jason);
    }
    return errorState(context, 'Token response was not ok', tokenResponse.status);
  }

  try {
    const result = v.safeParse(WorkingTokenResponseSchema, await tokenResponse.json());
    if (!result.success) {
      return errorState(context, 'Invalid token response', v.summarize(result.issues));
    }
    token = result.output;
  } catch (error: unknown) {
    return errorState(context, 'Failed to validate token response', error);
  }

  let user: Claims;
  let userResponse: Response;
  try {
    userResponse = await requestUserinfo(context, token);
  } catch (error: unknown) {
    return errorState(context, 'Error while fetching userinfo', error);
  }

  if (!userResponse.ok) {
    if (isJsonResponse(userResponse)) {
      return errorState(context, 'Userinfo response was not ok', await userResponse.json());
    }
    return errorState(context, 'Userinfo response was not ok', userResponse.status);
  }

  try {
    const result = v.safeParse(ClaimsSchema, await userResponse.json());
    if (!result.success) {
      return errorState(context, 'Invalid userinfo response', v.summarize(result.issues));
    }
    user = result.output;
  } catch (error: unknown) {
    return errorState(context, 'Error while parsing userinfo response', error);
  }
  const authCache = packTokenAndUser(token, user);
  localStorage.setItem(context.storageKey, JSON.stringify(authCache));

  return { type: 'logged-in', context: { ...context, authCache } };
};

const processRenewLogin = async ({ context }: StateOf<'renew-login'>): Transition => {
  // no refresh token to refresh, force login
  if (context.authCache.tokenResponse.refresh_token === undefined) {
    return { type: 'start-oauth', context };
  }

  return withRefreshLock(context.storageKey, () => refreshLocked(context));
};

export default processRenewLogin;
