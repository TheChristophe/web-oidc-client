import AuthInternalState, { type AuthState } from './AuthInternalState';
import { type Endpoints } from '../Configuration';
import IncomingRedirectState from './IncomingRedirectState';
import CheckLoginState from './CheckLoginState';

class RedirectCheckState extends AuthInternalState {
  override state: AuthState<'endpoints'>;

  constructor(state: AuthState, endpoints: Endpoints) {
    super(state);
    this.state = {
      ...state,
      endpoints,
    };
  }

  override async process() {
    const params = new URLSearchParams(window.location.search);

    if (
      this.hasPendingRedirect() &&
      // TODO: incomplete params, handle specifically?
      params.get('code') != null &&
      params.get('state') != null
    ) {
      return new IncomingRedirectState(this.state, this.state.endpoints, params);
    }
    return new CheckLoginState(this.state, this.state.endpoints);
  }

  protected hasPendingRedirect() {
    return (
      localStorage.getItem(this.oauthStateKey) !== null &&
      localStorage.getItem(this.oauthChallengeKey) !== null
    );
  }
}

export default RedirectCheckState;
