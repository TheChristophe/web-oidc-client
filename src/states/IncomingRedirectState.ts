import {
  type AuthContext,
  type StateOf,
  type Transition,
  errorState,
  oauthChallengeKey,
  oauthStateKey,
} from './AuthMachineState';
import { type TokenResponse, type WorkingTokenResponse } from '../oauthTypes';
import type AuthCache from '../AuthCache';
import type Claims from '../Claims';
import isJsonResponse from '../isJsonResponse';
import { logDebug } from '../console';

type Context = AuthContext<'endpoints'>;

const requestToken = async (context: Context, code: string, challenge: string): Promise<Response> =>
  fetch(context.endpoints.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: context.configuration.redirectionUrl,
      client_id: context.configuration.clientId,
      code_verifier: challenge,
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

/**
 * Remove a state from valid states
 *
 * @param context machine context
 * @param state authentication state to remove
 */
const popValidState = (context: Context, state: string): boolean => {
  const storedState = localStorage.getItem(oauthStateKey(context));
  if (state !== storedState) {
    context.configuration.debug &&
      logDebug('Received state', state, 'did not match stored state', storedState);
    return false;
  }
  localStorage.removeItem(oauthStateKey(context));
  return true;
};

const processIncomingRedirect = async ({
  context,
  params,
}: StateOf<'incoming-redirect'>): Transition => {
  const code = params.get('code');
  const state = params.get('state');
  if (code == null || state == null) {
    return errorState(context, 'Missing code or state in oauth redirect');
  }
  if (!popValidState(context, state)) {
    return errorState(context, 'Invalid state in oauth redirect');
  }
  const challenge = localStorage.getItem(oauthChallengeKey(context));
  if (challenge == null) {
    return errorState(context, 'Missing challenge code');
  }

  // TODO nextjs router ?
  //const params = new URLSearchParams(window.location.search);
  //params.delete('code');
  //params.delete('state');
  // TODO: delete not working properly
  window.history.replaceState(null, '', `${window.location.origin}${window.location.pathname}`); // ?${params}`);

  localStorage.removeItem(context.storageKey);

  let token: WorkingTokenResponse;
  let tokenResponse: Response;
  try {
    tokenResponse = await requestToken(context, code, challenge);
  } catch (error: unknown) {
    return errorState(
      context,
      'Error while fetching token',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }

  if (!tokenResponse.ok) {
    if (isJsonResponse(tokenResponse)) {
      return errorState(context, 'Bad token response', await tokenResponse.json());
    }
    return errorState(context, 'Bad token response', tokenResponse.status);
  }

  try {
    // TODO: validate fields from tokenResponse
    const maybeToken: TokenResponse = await tokenResponse.json();

    if (maybeToken.expires_in === undefined) {
      return errorState(context, 'This OIDC implementation requires expires_in to be set');
    }

    // TODO: how to make typescript happy with this because the condition above should already cover this
    token = maybeToken as WorkingTokenResponse;
  } catch (error: unknown) {
    return errorState(context, 'Error while parsing token response', error);
  }

  localStorage.removeItem(oauthChallengeKey(context));

  let user: Claims;
  let userResponse: Response;
  try {
    userResponse = await requestUserinfo(context, token);
  } catch (error: unknown) {
    return errorState(context, 'Error while fetching user info', error);
  }

  if (!userResponse.ok) {
    if (isJsonResponse(userResponse)) {
      return errorState(context, 'Bad userinfo response', await userResponse.json());
    }
    return errorState(context, 'Bad userinfo response', userResponse.status);
  }

  try {
    // TODO: validate fields from userResponse
    user = await userResponse.json();
  } catch (error: unknown) {
    return errorState(
      context,
      'Error while parsing user info',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
  const authCache = packTokenAndUser(token, user);
  localStorage.setItem(context.storageKey, JSON.stringify(authCache));

  return { type: 'logged-in', context: { ...context, authCache } };
};

export default processIncomingRedirect;
