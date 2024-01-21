import AuthInternalState, { type AuthState } from './AuthInternalState';
import { type Endpoints } from '../Configuration';
import LoggedInState from './LoggedInState';
import { type TokenResponse, type WorkingTokenResponse } from '../oauthTypes';
import type AuthCache from '../AuthCache';
import type Claims from '../Claims';
import ErrorState from './ErrorState';

export class IncomingRedirectState extends AuthInternalState {
  override state: AuthState<'endpoints'>;
  params: URLSearchParams;

  constructor(state: AuthState, endpoints: Endpoints, params: URLSearchParams) {
    super(state);
    this.state = {
      ...state,
      endpoints,
    };
    this.params = params;
  }

  override async process() {
    this.processOauthRedirect();
  }

  private async processOauthRedirect() {
    const code = this.params.get('code');
    const state = this.params.get('state');
    if (code == null || state == null) {
      this.advance(ErrorState, 'Missing code or state in oauth redirect');
      return;
    }
    if (this.getValidState() !== state) {
      this.advance(ErrorState, 'Invalid state in oauth redirect');
      return;
    }
    const challenge = sessionStorage.getItem(`${this.state.storageKey}.code_verifier`);
    if (challenge == null) {
      this.advance(ErrorState, 'Missing challenge code');
      return;
    }

    this.popValidState(state);

    // TODO nextjs router ?
    const params = new URLSearchParams(window.location.search);
    params.delete('code');
    params.delete('state');
    window.history.replaceState(null, '', `${window.location.origin}?${this.params}`);

    localStorage.removeItem(this.state.storageKey);

    let token: WorkingTokenResponse;
    try {
      const tokenResponse = await this.requestToken(code, challenge);

      // TODO: validate fields from tokenResponse
      const maybeToken: TokenResponse = await tokenResponse.json();

      if (maybeToken.expires_in === undefined) {
        this.advance(ErrorState, 'This OAuth2.0 implementation requires expires_in to be set');
        console.error('Received oauth token response without expires_in');
        return;
      }

      // TODO: how to make typescript happy with this because the condition above should already cover this
      token = maybeToken as WorkingTokenResponse;
    } catch (error: unknown) {
      this.advance(ErrorState, 'Error while fetching token');
      console.error(error);
      return;
    }

    sessionStorage.removeItem(`${this.state.storageKey}.code_verifier`);

    let user: Claims;
    try {
      const userResponse = await this.requestUserinfo(token);

      // TODO: validate fields from userResponse
      user = await userResponse.json();
    } catch (error: unknown) {
      this.advance(ErrorState, 'Error while fetching user info');
      console.error(error);
      return;
    }
    const cache = this.packTokenAndUser(token, user);
    localStorage.setItem(this.state.storageKey, JSON.stringify(cache));

    this.advance(LoggedInState, cache);
  }

  private async requestToken(code: string, challenge: string): Promise<Response> {
    return fetch(this.state.endpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.state.configuration.redirectionUrl,
        client_id: this.state.configuration.clientId,
        code_verifier: challenge,
      }),
    });
  }

  private async requestUserinfo(token: WorkingTokenResponse): Promise<Response> {
    return fetch(this.state.endpoints.userinfo, {
      headers: { Authorization: `${token.token_type} ${token.access_token}` },
    });
  }

  private packTokenAndUser(token: WorkingTokenResponse, user: Claims): AuthCache {
    const expiresAt = Date.now() + token.expires_in * 1000;

    return {
      tokenResponse: token,
      user,
      expiresAt,
    };
  }

  /**
   * Fetch the last generated authentication state
   */
  private getValidState(): string | null {
    return localStorage.getItem(`${this.state.storageKey}.state`);
  }

  /**
   * Remove a state from valid states
   *
   * @param state authentication state to remove
   */
  private popValidState(state: string): boolean {
    const storedState = this.getValidState();
    // TODO: remove state parameter? this implementation is not filtering an array of valid states anymore
    if (state !== storedState) {
      return false;
    }
    localStorage.removeItem(`${this.state.storageKey}.state`);
    return true;
  }
}
