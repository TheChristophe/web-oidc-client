import AuthInternalState from './AuthInternalState';
import type Status from '../Status';
import { AuthStatus } from '../Status';

class NotLoggedInState extends AuthInternalState {
  override async process() {
    localStorage.removeItem(this.state.storageKey);
  }

  public override getStatus(): Status {
    return {
      status: AuthStatus.NotLoggedIn,
    };
  }
}

export default NotLoggedInState;
