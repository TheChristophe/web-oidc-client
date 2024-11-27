import AuthInternalState from './AuthInternalState';
import { type Endpoints } from '../Configuration';
import RedirectCheckState from './RedirectCheckState';
import { logWarn } from '../console';
import ErrorState from './ErrorState';
import isJsonResponse from '../isJsonResponse';

class FetchError extends Error {
  constructor(
    message: string,
    public readonly extra?: unknown,
  ) {
    super(message);
  }
}

class LoadEndpointsState extends AuthInternalState {
  private readonly endpointsKey = `${this.state.storageKey}.${this.state.configuration.authority}.endpoints`;

  override async process() {
    const endpoints =
      this.state.endpoints ?? this.state.configuration.endpoints ?? this.tryGetStoredEndpoints();
    if (endpoints == null) {
      try {
        const newEndpoints = await this.fetchEndpoints();
        return new RedirectCheckState(this.state, newEndpoints);
      } catch (e: unknown) {
        // TODO: don't use exception for control flow
        if (e instanceof FetchError) {
          return new ErrorState(this.state, e.message, e.extra);
        }
        return new ErrorState(this.state, 'Unknown error while fetching OIDC endpoints', e);
      }
    } else {
      return new RedirectCheckState(this.state, endpoints);
    }
  }

  private async fetchEndpoints(): Promise<Endpoints> {
    let response: Response;
    try {
      response = await fetch(
        `${this.state.configuration.authority}/.well-known/openid-configuration`,
      );
    } catch (error: unknown) {
      throw new FetchError('Could not fetch OIDC well-known', error);
    }

    if (!response.ok) {
      if (isJsonResponse(response)) {
        throw new FetchError('OIDC well-known response was not ok', await response.json());
      } else {
        throw new FetchError('OIDC well-known response was not ok', response.status);
      }
    }

    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch (error: unknown) {
      throw new FetchError('Could not parse OIDC well-known', error);
    }

    try {
      this.validateOidcWellknown(data);
    } catch (e: unknown) {
      throw new FetchError('Could not validate required fields from OIDC well-known', e);
    }

    localStorage.setItem(this.endpointsKey, JSON.stringify(data satisfies Endpoints));

    return data;
  }

  private tryGetStoredEndpoints(): Endpoints | null {
    const stored = localStorage.getItem(this.endpointsKey);
    if (stored === null) {
      return null;
    }

    try {
      const json = JSON.parse(stored);
      this.validateOidcWellknown(json);
      return json;
    } catch (e: unknown) {
      logWarn(
        'Stored endpoints look invalid, resetting',
        e instanceof Error ? e.message : 'Unknown error',
        stored,
      );
      localStorage.removeItem(this.endpointsKey);
      return null;
    }
  }

  private validateOidcWellknown(data: Record<string, unknown>): asserts data is Endpoints {
    if (typeof data['authorization_endpoint'] !== 'string') {
      throw new Error('Missing authorization_endpoint in OIDC well-known');
    }
    if (typeof data['token_endpoint'] !== 'string') {
      throw new Error('Missing token_endpoint in OIDC well-known');
    }
    if (typeof data['revocation_endpoint'] !== 'string') {
      throw new Error('Missing revocation_endpoint in OIDC well-known');
    }
    if (typeof data['userinfo_endpoint'] !== 'string') {
      throw new Error('Missing userinfo_endpoint in OIDC well-known');
    }
  }
}

export default LoadEndpointsState;
