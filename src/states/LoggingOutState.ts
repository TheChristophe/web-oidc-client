import AuthInternalState from './AuthInternalState';
import NotLoggedInState from './NotLoggedInState';
import { logWarn } from '../console';

class LoggingOutState extends AuthInternalState {
  override async process() {
    try {
      await this.revokeToken();
    } catch (error) {
      // log the error but ultimately ignore it
      logWarn('Failed to revoke token', error);
    }

    this.advance(NotLoggedInState);
  }

  private async revokeToken() {
    if (
      this.state.endpoints == null ||
      this.state.authCache == null ||
      this.state.authCache.tokenResponse.refresh_token == null
    ) {
      return;
    }

    return fetch(this.state.endpoints.revocation, {
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
}

export default LoggingOutState;
