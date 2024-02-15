import { type Endpoints, type OidcWellknownEndpoints } from '../Configuration';
import AuthInternalState from './AuthInternalState';
import RedirectCheckState from './RedirectCheckState';
import ErrorState from './ErrorState';
import isJsonResponse from '../isJsonResponse';

class FetchingEndpointsState extends AuthInternalState {
  override async process() {
    let response: Response;
    try {
      response = await fetch(
        `${this.state.configuration.authority}/.well-known/openid-configuration`,
      );
    } catch (error: unknown) {
      this.advance(ErrorState, 'Could not fetch OIDC well-known', error);
      return;
    }
    if (!response.ok) {
      if (isJsonResponse(response)) {
        this.advance(ErrorState, 'OIDC well-known response was not ok', await response.json());
      } else {
        this.advance(ErrorState, 'OIDC well-known response was not ok', response.status);
      }
      return;
    }
    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch (error: unknown) {
      this.advance(ErrorState, 'Could not parse OIDC well-known', error);
      return;
    }

    try {
      this.validateOidcWellknown(data);
    } catch (e: unknown) {
      this.advance(ErrorState, 'Could not validate required fields from OIDC well-known', e);
      return;
    }

    localStorage.setItem(
      `${this.state.storageKey}.${this.state.configuration.authority}.endpoints`,
      JSON.stringify({
        authorization: data['authorization_endpoint'],
        token: data['token_endpoint'],
        userinfo: data['userinfo_endpoint'],
        revocation: data['revocation_endpoint'],
      } satisfies Endpoints),
    );

    this.advance(RedirectCheckState, {
      authorization: data['authorization_endpoint'],
      token: data['token_endpoint'],
      userinfo: data['userinfo_endpoint'],
      revocation: data['revocation_endpoint'],
    });
  }

  private validateOidcWellknown(
    data: Record<string, unknown>,
  ): asserts data is OidcWellknownEndpoints {
    if (typeof data['authorization_endpoint'] !== 'string') {
      throw new Error('Missing authorization_endpoint in OIDC well-known');
    }
    if (typeof data['token_endpoint'] !== 'string') {
      throw new Error('Missing token_endpoint in OIDC well-known');
    }
    if (typeof data['userinfo_endpoint'] !== 'string') {
      throw new Error('Missing userinfo_endpoint in OIDC well-known');
    }
    if (typeof data['revocation_endpoint'] !== 'string') {
      throw new Error('Missing revocation_endpoint in OIDC well-known');
    }
  }
}

export default FetchingEndpointsState;
