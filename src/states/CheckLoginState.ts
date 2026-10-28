import AuthInternalState, { type AuthState } from './AuthInternalState';
import LoggedInState from './LoggedInState';
import NotLoggedInState from './NotLoggedInState';
import type AuthCache from '../AuthCache';
import RenewLoginState from './RenewLoginState';
import { type Endpoints } from '../Configuration';
import { readStoredLogin } from '../storedLogin';

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
    const cached = readStoredLogin(this.state.storageKey);
    if (cached != null) {
      if (this.hasExpired(cached)) {
        return new RenewLoginState(this.state, cached, this.state.endpoints);
      }
      return new LoggedInState(this.state, cached);
    }
    return new NotLoggedInState(this.state);
  }

  private hasExpired(data: AuthCache): boolean {
    return data.expiresAt < Date.now();
  }
}

export default CheckLoginState;
