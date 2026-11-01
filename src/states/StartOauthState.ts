import {
  type AuthContext,
  type StateOf,
  type Transition,
  oauthChallengeKey,
  oauthStateKey,
} from './AuthMachineState';

// https://datatracker.ietf.org/doc/html/rfc7636#section-4.1
const PKCE_POSSIBLE_CHARACTERS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._';

// taken from https://github.com/curityio/pkce-javascript-example
const generatePkce = () => {
  let text = '';

  for (let i = 0; i < 96; i++) {
    text += PKCE_POSSIBLE_CHARACTERS.charAt(
      Math.floor(Math.random() * PKCE_POSSIBLE_CHARACTERS.length),
    );
  }

  return text;
};

const generateCodeChallenge = async (codeVerifier: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

/**
 * Generate a new authentication state and store it
 */
const newValidState = (context: AuthContext): string => {
  const state = Math.random().toString(36).substring(2, 15);
  localStorage.setItem(oauthStateKey(context), state);
  return state;
};

const processStartOauth = async ({ context }: StateOf<'start-oauth'>): Transition => {
  const state = newValidState(context);
  const challenge = generatePkce();
  localStorage.setItem(oauthChallengeKey(context), challenge);

  const codeChallenge = await generateCodeChallenge(challenge);
  // TODO: make type for this
  //       https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1
  //       https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
  window.location.href = `${context.endpoints.authorization_endpoint}?${new URLSearchParams({
    client_id: context.configuration.clientId,
    redirect_uri: context.configuration.redirectionUrl,
    response_type: 'code',
    scope: context.configuration.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString()}`;

  // no state, leaving page
  return undefined;
};

export default processStartOauth;
