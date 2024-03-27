import AuthInternalState, { type AuthState } from './AuthInternalState';
import { type Endpoints } from '../Configuration';

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

class StartOauthState extends AuthInternalState {
  override state: AuthState<'endpoints'>;

  constructor(state: AuthState, endpoints: Endpoints) {
    super(state);
    this.state = {
      ...state,
      endpoints,
    };
  }

  override async process(): Promise<void> {
    const state = this.newValidState();
    const challenge = generatePkce();
    localStorage.setItem(`${this.state.storageKey}.code_verifier`, challenge);

    const codeChallenge = await generateCodeChallenge(challenge);
    window.location.href = `${this.state.endpoints.authorization_endpoint}?${new URLSearchParams({
      client_id: this.state.configuration.clientId,
      redirect_uri: this.state.configuration.redirectionUrl,
      response_type: 'code',
      scope: this.state.configuration.scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString()}`;
  }

  /**
   * Generate a new authentication state and store it
   */
  private newValidState(): string {
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem(`${this.state.storageKey}.state`, state);
    return state;
  }
}

export default StartOauthState;
