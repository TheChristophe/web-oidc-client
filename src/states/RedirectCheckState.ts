import AuthInternalState, { type AuthState } from './AuthInternalState';
import { type Endpoints } from '../Configuration';
import { IncomingRedirectState } from './IncomingRedirectState';
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
    const code = params.get('code');
    if (code !== null) {
      this.advance(IncomingRedirectState, this.state.endpoints, params);
    } else {
      this.advance(CheckLoginState, this.state.endpoints);
    }
  }
}

export default RedirectCheckState;
