import type AuthCache from '../AuthCache';
import AuthInternalState, { type AuthState } from './AuthInternalState';
import { type TokenResponse, type WorkingTokenResponse } from '../oauthTypes';
import ErrorState from './ErrorState';
import type Claims from '../Claims';
import LoggedInState from './LoggedInState';
import { type Endpoints } from '../Configuration';
import StartOauthState from './StartOauthState';
class RenewLoginState extends AuthInternalState {
  override state: AuthState<'authCache' | 'endpoints'>;

  constructor(state: AuthState, authCache: AuthCache, endpoints: Endpoints) {
    super(state);
    this.state = {
      ...state,
      authCache,
      endpoints,
    };
  }

  override async process() {
    // no refresh token to refresh, force login
    if (this.state.authCache.tokenResponse.refresh_token === undefined) {
      this.advance(StartOauthState, this.state.endpoints);
      return;
    }

    let token: WorkingTokenResponse;
    try {
      const tokenResponse = await this.requestToken(
        this.state.authCache.tokenResponse.refresh_token,
      );

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

    dispatchEvent(new Event('newAuth'));

    this.advance(LoggedInState, cache);
  }

  private async requestToken(refresh_token: string): Promise<Response> {
    return fetch(this.state.endpoints.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        redirect_uri: this.state.configuration.redirectionUrl,
        client_id: this.state.configuration.clientId,
        // optional
        //scope: this.state.configuration.scopes,
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
}

export default RenewLoginState;
