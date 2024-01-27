import AuthInternalState from './AuthInternalState';
import { type Endpoints } from '../Configuration';
import RedirectCheckState from './RedirectCheckState';
import FetchingEndpointsState from './FetchingEndpointsState';
import { logWarn } from '../console';

class BrowserInitialState extends AuthInternalState {
  override async process() {
    const endpoints =
      this.state.endpoints ?? this.state.configuration.endpoints ?? this.tryGetStoredEndpoints();
    if (endpoints == null) {
      this.advance(FetchingEndpointsState);
    } else {
      this.advance(RedirectCheckState, endpoints);
    }
  }

  private tryGetStoredEndpoints(): Endpoints | null {
    const key = `${this.state.storageKey}.endpoints`;
    const stored = localStorage.getItem(key);
    if (stored === null) {
      return null;
    }

    try {
      const json = JSON.parse(stored);
      this.hasAllFields(json);
      return json;
    } catch (e: unknown) {
      logWarn('Stored endpoints look invalid, resetting', e);
      localStorage.removeItem(key);
      return null;
    }
  }

  private hasAllFields(data: Record<string, unknown>): asserts data is Endpoints {
    if (typeof data['authorization'] !== 'string') {
      throw new Error('Missing authorization_endpoint in OIDC well-known');
    }
    if (typeof data['token'] !== 'string') {
      throw new Error('Missing token_endpoint in OIDC well-known');
    }
    if (typeof data['revocation'] !== 'string') {
      throw new Error('Missing revocation_endpoint in OIDC well-known');
    }
    if (typeof data['userinfo'] !== 'string') {
      throw new Error('Missing userinfo_endpoint in OIDC well-known');
    }
  }
}

export default BrowserInitialState;
