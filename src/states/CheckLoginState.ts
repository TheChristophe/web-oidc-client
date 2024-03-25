import AuthInternalState, { type AuthState } from './AuthInternalState';
import LoggedInState from './LoggedInState';
import NotLoggedInState from './NotLoggedInState';
import type AuthCache from '../AuthCache';
import { type TokenResponse } from '../oauthTypes';
import type Claims from '../Claims';
import RenewLoginState from './RenewLoginState';
import { type Endpoints } from '../Configuration';
import { logWarn } from '../console';

class CheckLoginState extends AuthInternalState {
  override state: AuthState<'endpoints'>;

  constructor(state: AuthState, endpoints: Endpoints) {
    super(state);
    this.state = {
      ...state,
      endpoints,
    };
  }

  override async process() {
    const cached = this.tryGetStoredLogin();
    if (cached != null) {
      if (this.hasExpired(cached)) {
        this.advance(RenewLoginState, cached, this.state.endpoints);
      } else {
        this.advance(LoggedInState, cached);
      }
    } else {
      this.advance(NotLoggedInState);
    }
  }

  private tryGetStoredLogin(): AuthCache | null {
    const stored = localStorage.getItem(this.state.storageKey);
    if (stored === null) {
      return null;
    }

    try {
      const json = JSON.parse(stored);
      this.validateCache(json);
      return json;
    } catch (e: unknown) {
      logWarn(
        'Stored endpoints look invalid, resetting',
        e instanceof Error ? e.message : 'Unknown error',
        stored,
      );
      localStorage.removeItem(this.state.storageKey);
      return null;
    }
  }

  private hasExpired(data: AuthCache): boolean {
    return data.expiresAt < Date.now();
  }

  private validateCache(data: unknown): asserts data is AuthCache {
    if (
      typeof data !== 'object' ||
      data == null ||
      !('tokenResponse' in data) ||
      !('user' in data) ||
      !('expiresAt' in data)
    ) {
      throw new Error('Incomplete stored login');
    }
    const { tokenResponse, user, expiresAt } = data;

    this.validateTokenResponse(tokenResponse);
    this.validateClaims(user);
    if (typeof expiresAt !== 'number') {
      throw new Error('Invalid expiresAt');
    }
  }

  private validateTokenResponse(tokenResponse: unknown): asserts tokenResponse is TokenResponse {
    if (
      typeof tokenResponse !== 'object' ||
      tokenResponse == null ||
      !('access_token' in tokenResponse) ||
      typeof tokenResponse['access_token'] !== 'string' ||
      !('token_type' in tokenResponse) ||
      typeof tokenResponse['token_type'] !== 'string' ||
      !('expires_in' in tokenResponse) ||
      typeof tokenResponse['expires_in'] !== 'number' ||
      !('refresh_token' in tokenResponse) ||
      typeof tokenResponse['refresh_token'] !== 'string' ||
      !('scope' in tokenResponse) ||
      typeof tokenResponse['scope'] !== 'string'
    ) {
      throw new Error('Invalid cached tokenResponse');
    }
  }

  private validateClaims(userinfo: unknown): asserts userinfo is Claims {
    if (
      typeof userinfo !== 'object' ||
      userinfo == null ||
      !('sub' in userinfo) ||
      typeof userinfo['sub'] !== 'string'
    ) {
      throw new Error('Invalid userinfo');
    }

    // no other fields are guaranteed
  }
}

export default CheckLoginState;
