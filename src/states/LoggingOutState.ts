import { type AuthContext, type StateOf, type Transition } from './AuthMachineState';
import { logWarn } from '../console';

const revokeToken = async ({ endpoints, authCache, configuration }: AuthContext) => {
  if (endpoints == null || authCache == null || authCache.tokenResponse.refresh_token == null) {
    return;
  }

  return fetch(endpoints.revocation_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: configuration.clientId,
      token: authCache.tokenResponse.refresh_token,
      token_type_hint: 'refresh_token',
    }),
  });
  // we don't really care about the response, we're dropping it from our storage regardless
};

const endSession = async ({ endpoints, authCache, configuration }: AuthContext) => {
  if (
    endpoints == null ||
    authCache == null ||
    endpoints.end_session_endpoint == null ||
    authCache.tokenResponse.refresh_token == null ||
    authCache.tokenResponse.id_token == null
  ) {
    return;
  }

  window.location.href = `${endpoints.end_session_endpoint}?${new URLSearchParams({
    client_id: configuration.clientId,
    id_token_hint: authCache.tokenResponse.id_token,
    post_logout_redirect_uri: configuration.postLogoutRedirectionUrl ?? window.location.origin,
  }).toString()}`;
};

const processLoggingOut = async ({ context }: StateOf<'logging-out'>): Transition => {
  try {
    await revokeToken(context);

    localStorage.removeItem(context.storageKey);

    // may redirect to another page
    await endSession(context);
  } catch (error) {
    // log the error but ultimately ignore it
    logWarn('Failed to revoke token', error instanceof Error ? error.message : 'Unknown error');
  }

  return { type: 'not-logged-in', context };
};

export default processLoggingOut;
