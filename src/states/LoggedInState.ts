import type AuthCache from '../AuthCache';
import AuthInternalState, { type AuthState } from './AuthInternalState';
import type Status from '../Status';
import { AuthStatus } from '../Status';

class LoggedInState extends AuthInternalState {
  override state: AuthState<'authCache'>;

  constructor(state: AuthState, authCache: AuthCache) {
    super(state);
    this.state = {
      ...state,
      authCache,
    };
  }

  public override getStatus(): Status {
    return {
      status: AuthStatus.LoggedIn,
      user: this.state.authCache.user,
      auth: {
        token: this.state.authCache.tokenResponse.access_token,
      },
    };
  }
}

export default LoggedInState;
