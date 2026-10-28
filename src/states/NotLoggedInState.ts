import AuthInternalState from './AuthInternalState';
import type Status from '../Status';
import { AuthStatus } from '../Status';
import { clearStoredLogin } from '../storedLogin';

class NotLoggedInState extends AuthInternalState {
  override async process() {
    clearStoredLogin(this.state.storageKey, this.state.authCache);
    return undefined;
  }

  public override getStatus(): Status {
    return {
      status: AuthStatus.NotLoggedIn,
    };
  }
}

export default NotLoggedInState;
