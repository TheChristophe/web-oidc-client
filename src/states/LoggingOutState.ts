import AuthInternalState from './AuthInternalState';
import NotLoggedInState from './NotLoggedInState';
import { logWarn } from '../console';

class LoggingOutState extends AuthInternalState {
  override async process() {
    try {
      await this.revokeToken();

      localStorage.removeItem(this.state.storageKey);

      // may redirect to another page
      await this.endSession();
    } catch (error) {
      // log the error but ultimately ignore it
      logWarn('Failed to revoke token', error instanceof Error ? error.message : 'Unknown error');
    }

    return new NotLoggedInState(this.state);
  }

  private async revokeToken() {
    if (
      this.state.endpoints == null ||
      this.state.authCache == null ||
      this.state.authCache.tokenResponse.refresh_token == null
    ) {
      return;
    }

    return fetch(this.state.endpoints.revocation_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.state.configuration.clientId,
        token: this.state.authCache.tokenResponse.refresh_token,
        token_type_hint: 'refresh_token',
      }),
    });
    // we don't really care about the response, we're dropping it from our storage regardless
  }

  private async endSession() {
    if (
      this.state.endpoints == null ||
      this.state.authCache == null ||
      this.state.endpoints.end_session_endpoint == null ||
      this.state.authCache.tokenResponse.refresh_token == null ||
      this.state.authCache.tokenResponse.id_token == null
    ) {
      return;
    }

    window.location.href = `${this.state.endpoints.end_session_endpoint}?${new URLSearchParams({
      client_id: this.state.configuration.clientId,
      id_token_hint: this.state.authCache.tokenResponse.id_token,
      post_logout_redirect_uri:
        this.state.configuration.postLogoutRedirectionUrl ?? window.location.origin,
    }).toString()}`;
  }
}

export default LoggingOutState;
