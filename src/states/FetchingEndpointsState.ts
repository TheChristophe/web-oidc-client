import { type Endpoints, type OidcWellknownEndpoints } from '../Configuration';
import AuthInternalState from './AuthInternalState';
import RedirectCheckState from './RedirectCheckState';
import ErrorState from './ErrorState';

class FetchingEndpointsState extends AuthInternalState {
  override async process() {
    const response = await fetch(
      `${this.state.configuration.authority}/.well-known/openid-configuration`,
    );
    if (!response.ok) {
      this.advance(ErrorState, 'Could not fetch OIDC well-known');
      return;
    }
    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch (error) {
      this.advance(ErrorState, 'Could not parse OIDC well-known');
      console.error(error);
      return;
    }

    try {
      this.validateOidcWellknown(data);
    } catch (e: unknown) {
      if (e instanceof Error) {
        this.advance(ErrorState, e.message);
        return;
      }
      this.advance(ErrorState, 'Could not validate required fields from OIDC well-known');
      return;
    }

    localStorage.setItem(
      `${this.state.storageKey}.endpoints`,
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
