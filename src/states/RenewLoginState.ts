import type AuthCache from '../AuthCache';
import AuthInternalState, { type AuthState } from './AuthInternalState';
import { type TokenResponse, type WorkingTokenResponse } from '../oauthTypes';
import ErrorState from './ErrorState';
import type Claims from '../Claims';
import LoggedInState from './LoggedInState';
import { type Endpoints } from '../Configuration';
import StartOauthState from './StartOauthState';
import isJsonResponse from '../isJsonResponse';
import type Status from '../Status';
import { LOADING, AuthStatus } from '../Status';
class RenewLoginState extends AuthInternalState {
  override state: AuthState<'authCache' | 'endpoints'>;

  constructor(
    state: AuthState,
    authCache: AuthCache,
    endpoints: Endpoints,
    private refresh: boolean = false,
  ) {
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
    let tokenResponse: Response;
    try {
      tokenResponse = await this.requestToken(this.state.authCache.tokenResponse.refresh_token);
    } catch (error: unknown) {
      this.advance(ErrorState, 'Error while renewing token', error);
      return;
    }

    if (!tokenResponse.ok) {
      if (isJsonResponse(tokenResponse)) {
        this.advance(ErrorState, 'Token response was not ok', await tokenResponse.json());
      } else {
        this.advance(ErrorState, 'Token response was not ok', tokenResponse.status);
      }
      return;
    }

    try {
      // TODO: validate fields from tokenResponse
      const maybeToken: TokenResponse = await tokenResponse.json();

      if (maybeToken.expires_in === undefined) {
        this.advance(ErrorState, 'This OAuth2.0 implementation requires expires_in to be set');
        return;
      }

      // TODO: how to make typescript happy with this because the condition above should already cover this
      token = maybeToken as WorkingTokenResponse;
    } catch (error: unknown) {
      this.advance(ErrorState, 'Failed to validate token response', error);
      return;
    }

    let user: Claims;
    let userResponse: Response;
    try {
      userResponse = await this.requestUserinfo(token);
    } catch (error: unknown) {
      this.advance(ErrorState, 'Error while fetching userinfo', error);
      return;
    }

    if (!userResponse.ok) {
      if (isJsonResponse(userResponse)) {
        this.advance(ErrorState, 'Userinfo response was not ok', await userResponse.json());
      } else {
        this.advance(ErrorState, 'Userinfo response was not ok', userResponse.status);
      }
      return;
    }

    try {
      // TODO: validate fields from userResponse
      user = await userResponse.json();
    } catch (error: unknown) {
      this.advance(ErrorState, 'Error while parsing userinfo response', error);
      return;
    }
    const cache = this.packTokenAndUser(token, user);
    localStorage.setItem(this.state.storageKey, JSON.stringify(cache));

    dispatchEvent(new Event('newAuth'));

    this.advance(LoggedInState, cache);
  }

  private async requestToken(refresh_token: string): Promise<Response> {
    return fetch(this.state.endpoints.token_endpoint, {
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

  // return cached status to not move application back to loading state
  public override getStatus(): Status {
    if (this.refresh) {
      // return cached status as it's not likely to have expired yet (5-min window)
      return {
        status: AuthStatus.LoggedIn,
        user: this.state.authCache.user,
        auth: {
          token: this.state.authCache.tokenResponse.access_token,
        },
      };
    }

    return LOADING;
  }
}

export default RenewLoginState;
