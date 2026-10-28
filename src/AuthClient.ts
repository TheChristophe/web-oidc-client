import type AuthInternalState from './states/AuthInternalState';
import { type AuthState } from './states/AuthInternalState';
import LoadEndpointsState from './states/LoadEndpointsState';
import type Configuration from './Configuration';
import { type Endpoints, type InitialConfiguration } from './Configuration';
import type Status from './Status';
import { LOADING } from './Status';
import StartOauthState from './states/StartOauthState';
import RenewLoginState from './states/RenewLoginState';
import LoggedInState from './states/LoggedInState';
import LoggingOutState from './states/LoggingOutState';
import ErrorState from './states/ErrorState';
import { logError, logDebug } from './console';
import REFRESH_WINDOW from './refreshWindow';

export type AuthEventHandler = (event: Status) => void;

class AuthClient {
  readonly #initConfiguration: InitialConfiguration;
  #state: AuthInternalState | null = null;
  readonly #eventHandler: AuthEventHandler;
  #status: Status;

  #endpoints?: Endpoints;
  #tokenRenewal: ReturnType<typeof setTimeout> | null = null;

  #cycling: boolean = false;
  #pendingState: (() => AuthInternalState | undefined) | null = null;

  constructor(initialConfiguration: InitialConfiguration, eventHandler: AuthEventHandler) {
    this.#initConfiguration = initialConfiguration;
    this.#eventHandler = eventHandler;
    this.#status = LOADING;
  }

  /**
   * Initialize the auth client in the browser
   *
   * This is required to not break in SSR (e.g. Next.js)
   */
  public browserInit() {
    this.#initConfiguration.debug && logDebug('Browser Init');

    if (this.#state != null) {
      return;
    }
    this.advanceState(new LoadEndpointsState(this.getInitialState()));

    window.addEventListener('storage', (event) => {
      if (event.key === this.getInitialState().storageKey) {
        // other tab updated auth, reload once the current state is done processing
        this.#enqueue(this.#reload);
      }
    });
  }

  #reload = () => new LoadEndpointsState(this.getInitialState());

  /**
   * Move to a new state now, or after the current one is done processing
   *
   * A queued login or logout is never replaced, as it was requested by the user.
   */
  #enqueue(newState: () => AuthInternalState | undefined) {
    if (!this.#cycling) {
      const state = newState();
      if (state) {
        this.advanceState(state);
      }
      return;
    }

    if (this.#pendingState !== this.#newLogin && this.#pendingState !== this.#newLogout) {
      this.#pendingState = newState;
    }
  }

  #newLogin = () =>
    this.#endpoints
      ? new StartOauthState(this.#state?.getState() ?? this.getInitialState(), this.#endpoints)
      : undefined;
  /**
   * Log in the user anew
   */
  public login() {
    if (this.#pendingState === this.#newLogin) {
      return;
    }

    this.#initConfiguration.debug && logDebug('Queueing login');

    if (this.#cycling) {
      this.#pendingState = this.#newLogin;
    } else {
      const state = this.#newLogin();
      if (state) {
        this.advanceState(state);
      }
    }
  }

  #newLogout = () => new LoggingOutState(this.#state?.getState() ?? this.getInitialState());
  /**
   * Log out the user
   */
  public logout() {
    if (this.#pendingState === this.#newLogout) {
      return;
    }

    this.#initConfiguration.debug && logDebug('Queueing logout');

    if (this.#cycling) {
      this.#pendingState = this.#newLogout;
    } else {
      this.advanceState(this.#newLogout());
    }
  }

  #newRenew = () =>
    this.#endpoints && this.#state instanceof LoggedInState
      ? new RenewLoginState(
          this.#state.getState(),
          this.#state.state.authCache,
          this.#endpoints,
          true,
        )
      : undefined;
  /**
   * Renew credentials and user info
   */
  public renew() {
    this.#initConfiguration.debug && logDebug('renew');
    this.#enqueue(this.#newRenew);
  }

  /**
   * Get a complete configuration object for the browser
   *
   * @private
   */
  private getBrowserConfiguration(): Configuration {
    return {
      ...this.#initConfiguration,
      autoLogin: this.#initConfiguration.autoLogin === true,
      redirectionUrl:
        this.#initConfiguration.redirectionUrl ?? `${window.location.origin}/oauth-redirect`,
      postLogoutRedirectionUrl:
        this.#initConfiguration.postLogoutRedirectionUrl ?? window.location.origin,
      debug: this.#initConfiguration.debug ?? false,
    };
  }

  private getInitialState(): AuthState {
    return {
      configuration: this.getBrowserConfiguration(),

      storageKey: this.#initConfiguration.clientId,
    };
  }

  /**
   * Get the current auth status
   */
  public getState() {
    return this.#status;
  }

  /**
   * Move to a new state
   *
   * @param newState_ new state
   * @private
   */
  private async advanceState(newState_: AuthInternalState) {
    this.#cycling = true;
    let newState: AuthInternalState | undefined = newState_;
    while (newState !== undefined) {
      this.#initConfiguration.debug && logDebug('Moving to state', newState.constructor.name);

      if (newState instanceof ErrorState) {
        logError('Error state:', ...newState.getFullError());
      }

      this.#state = newState;
      this.#endpoints = newState.getState().endpoints ?? this.#endpoints;

      const newStatus = newState.getStatus();
      if (
        this.#status.status !== newStatus.status ||
        // update if token has changed, e.g. when refreshing
        (newStatus.status === 'logged-in' &&
          newStatus.status === this.#status.status &&
          newStatus.auth.token !== this.#status.auth.token)
      ) {
        this.#initConfiguration.debug && logDebug('Status changed', newStatus.status);
        this.#eventHandler(newStatus);
      }

      this.#status = this.#state.getStatus();

      // cancel pending renewal
      if (this.#tokenRenewal != null) {
        clearTimeout(this.#tokenRenewal);
        this.#tokenRenewal = null;
      }

      // schedule renewal if logged in
      // TODO: do this cleaner or elsewhere
      if (this.#state instanceof LoggedInState) {
        this.#initConfiguration.debug && logDebug('Queueing renewal');
        this.scheduleTokenRenewal(this.#state);
      }

      this.#initConfiguration.debug && logDebug('Processing state', newState.constructor.name);
      newState = await newState.process();
      if (newState === undefined && this.#pendingState !== null) {
        newState = this.#pendingState();
        this.#pendingState = null;
      }
    }
    this.#cycling = false;
  }

  private scheduleTokenRenewal(loggedIn: LoggedInState) {
    // TODO: do we want to schedule a renewal if there's no refresh token? this would involve a login flow, breaking
    //       user interaction
    //       then again, if you don't have refresh tokens enabled, what were you expecting anyway
    const state = loggedIn.state;
    const endpoints = this.#endpoints;

    if (endpoints !== undefined) {
      this.#tokenRenewal = setTimeout(
        () => this.#enqueue(() => new RenewLoginState(state, state.authCache, endpoints, true)),
        state.authCache.expiresAt - Date.now() - REFRESH_WINDOW,
      );
    }
  }
}

export default AuthClient;
