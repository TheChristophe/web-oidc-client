import AuthInternalState, { type AuthState } from './AuthInternalState';
import { type Endpoints } from '../Configuration';
import LoggedInState from './LoggedInState';
import { type TokenResponse, type WorkingTokenResponse } from '../oauthTypes';
import type AuthCache from '../AuthCache';
import type Claims from '../Claims';
import ErrorState from './ErrorState';
import isJsonResponse from '../isJsonResponse';
import { logDebug } from '../console';

class IncomingRedirectState extends AuthInternalState {
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
    const code = this.params.get('code');
    const state = this.params.get('state');
    if (code == null || state == null) {
      return new ErrorState(this.state, 'Missing code or state in oauth redirect');
    }
    if (!this.popValidState(state)) {
      return new ErrorState(this.state, 'Invalid state in oauth redirect');
    }
    const challenge = localStorage.getItem(this.oauthChallengeKey);
    if (challenge == null) {
      return new ErrorState(this.state, 'Missing challenge code');
    }

    // TODO nextjs router ?
    //const params = new URLSearchParams(window.location.search);
    //params.delete('code');
    //params.delete('state');
    // TODO: delete not working properly
    window.history.replaceState(null, '', `${window.location.origin}${window.location.pathname}`); // ?${this.params}`);

    localStorage.removeItem(this.state.storageKey);

    let token: WorkingTokenResponse;
    let tokenResponse: Response;
    try {
      tokenResponse = await this.requestToken(code, challenge);
    } catch (error: unknown) {
      return new ErrorState(
        this.state,
        'Error while fetching token',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }

    if (!tokenResponse.ok) {
      if (isJsonResponse(tokenResponse)) {
        return new ErrorState(this.state, 'Bad token response', await tokenResponse.json());
      }
      return new ErrorState(this.state, 'Bad token response', tokenResponse.status);
    }

    try {
      // TODO: validate fields from tokenResponse
      const maybeToken: TokenResponse = await tokenResponse.json();

      if (maybeToken.expires_in === undefined) {
        return new ErrorState(this.state, 'This OIDC implementation requires expires_in to be set');
      }

      // TODO: how to make typescript happy with this because the condition above should already cover this
      token = maybeToken as WorkingTokenResponse;
    } catch (error: unknown) {
      return new ErrorState(this.state, 'Error while parsing token response', error);
    }

    localStorage.removeItem(this.oauthChallengeKey);

    let user: Claims;
    let userResponse: Response;
    try {
      userResponse = await this.requestUserinfo(token);
    } catch (error: unknown) {
      return new ErrorState(this.state, 'Error while fetching user info', error);
    }

    if (!userResponse.ok) {
      if (isJsonResponse(userResponse)) {
        return new ErrorState(this.state, 'Bad userinfo response', await userResponse.json());
      }
      return new ErrorState(this.state, 'Bad userinfo response', userResponse.status);
    }

    try {
      // TODO: validate fields from userResponse
      user = await userResponse.json();
    } catch (error: unknown) {
      return new ErrorState(
        this.state,
        'Error while parsing user info',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
    const cache = this.packTokenAndUser(token, user);
    localStorage.setItem(this.state.storageKey, JSON.stringify(cache));

    return new LoggedInState(this.state, cache);
  }

  private async requestToken(code: string, challenge: string): Promise<Response> {
    return fetch(this.state.endpoints.token_endpoint, {
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
    return fetch(this.state.endpoints.userinfo_endpoint, {
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
   * Remove a state from valid states
   *
   * @param state authentication state to remove
   */
  private popValidState(state: string): boolean {
    const storedState = localStorage.getItem(this.oauthStateKey);
    if (state !== storedState) {
      this.state.configuration.debug &&
        logDebug('Received state', state, 'did not match stored state', storedState);
      return false;
    }
    localStorage.removeItem(this.oauthStateKey);
    return true;
  }
}

export default IncomingRedirectState;
