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

export type AuthEventHandler = (event: Status) => void;
type Pending = 'login' | 'logout' | 'renew';

// 5 minutes
const REFRESH_WINDOW = 1000 * 60 * 5;

class AuthClient {
  private readonly initConfiguration: InitialConfiguration;
  private state: AuthInternalState | null = null;
  private readonly eventHandler: AuthEventHandler;
  private status: Status;

  private pendingAction?: Pending;
  private endpoints?: Endpoints;
  private tokenRenewal: ReturnType<typeof setTimeout> | null = null;

  constructor(initialConfiguration: InitialConfiguration, eventHandler: AuthEventHandler) {
    this.initConfiguration = initialConfiguration;
    this.eventHandler = eventHandler;
    this.status = LOADING;
  }

  /**
   * Initialize the auth client in the browser
   *
   * This is required to not break in SSR (e.g. Next.js)
   */
  public browserInit() {
    this.initConfiguration.debug && logDebug('Browser Init');

    if (this.state != null) {
      return;
    }
    this.advanceState(new LoadEndpointsState(this.getInitialState()));

    window.addEventListener('storage', (event) => {
      if (event.key === this.getInitialState().storageKey) {
        // other tab updated auth, reload
        // TODO: risk: both tabs attempting to renew, with the slower tab causing it to end up in error state
        this.advanceState(new LoadEndpointsState(this.getInitialState()));
      }
    });
  }

  /**
   * Log in the user anew, regardless of previous state
   */
  public login() {
    if (this.pendingAction === 'login' || this.endpoints === undefined) {
      return;
    }

    this.initConfiguration.debug && logDebug('Login');

    if (this.status.status !== 'loading') {
      this.advanceState(
        new StartOauthState(this.state?.getState() ?? this.getInitialState(), this.endpoints),
      );
    } else {
      this.pendingAction = 'login';
    }
  }

  /**
   * Log out the user, regardless of previous state
   */
  public logout() {
    if (this.pendingAction === 'logout') {
      return;
    }

    this.initConfiguration.debug && logDebug('Logout');

    if (this.status.status !== 'loading') {
      this.advanceState(new LoggingOutState(this.state?.getState() ?? this.getInitialState()));
    } else {
      this.pendingAction = 'logout';
    }
  }

  /**
   * Renew credentials and user info
   */
  public renew() {
    if (
      this.pendingAction === 'logout' ||
      this.pendingAction === 'renew' ||
      // TODO: no instanceof
      !(this.state instanceof LoggedInState) ||
      this.endpoints == null
    ) {
      return;
    }

    this.initConfiguration.debug && logDebug('renew');

    const state: LoggedInState = this.state;
    if (this.status.status !== 'loading') {
      this.advanceState(
        new RenewLoginState(state.getState(), state.state.authCache, this.endpoints, true),
      );
    } else {
      this.pendingAction = 'renew';
    }
  }

  /**
   * Get a complete configuration object for the browser
   *
   * @private
   */
  private getBrowserConfiguration(): Configuration {
    return {
      ...this.initConfiguration,
      autoLogin: this.initConfiguration.autoLogin === true,
      redirectionUrl:
        this.initConfiguration.redirectionUrl ?? `${window.location.origin}/oauth-redirect`,
      debug: this.initConfiguration.debug ?? false,
    };
  }

  private getInitialState(): AuthState {
    return {
      configuration: this.getBrowserConfiguration(),
      advanceState: this.advanceState.bind(this),

      storageKey: this.initConfiguration.clientId,
    };
  }

  /**
   * Get the current auth status
   */
  public getState() {
    return this.status;
  }

  /**
   * Move to a new state
   *
   * @param newState new state
   * @private
   */
  private advanceState(newState: AuthInternalState) {
    this.initConfiguration.debug && logDebug('Moving to state', newState.constructor.name);

    if (newState instanceof ErrorState) {
      logError('Error state:', ...newState.getFullError());
    }

    this.state = newState;
    this.endpoints = newState.getState().endpoints ?? this.endpoints;

    const newStatus = newState.getStatus();
    if (
      this.status.status !== newStatus.status ||
      // update if token has changed, e.g. when refreshing
      (newStatus.status === 'logged-in' &&
        newStatus.status === this.status.status &&
        newStatus.auth.token !== this.status.auth.token)
    ) {
      this.initConfiguration.debug && logDebug('Status changed', newStatus.status);
      this.eventHandler(newStatus);
    }

    this.status = this.state.getStatus();

    // cancel pending renewal
    if (this.tokenRenewal != null) {
      clearTimeout(this.tokenRenewal);
      this.tokenRenewal = null;
    }
    // pending login
    if (this.pendingAction === 'login') {
      this.initConfiguration.debug && logDebug('Executing pending login');
      this.pendingAction = undefined;
      return this.login();
    }
    // pending logout
    if (this.pendingAction === 'logout') {
      this.initConfiguration.debug && logDebug('Executing pending logout');
      this.pendingAction = undefined;
      return this.logout();
    }
    // pending renew
    if (this.pendingAction === 'renew') {
      this.initConfiguration.debug && logDebug('Executing pending renew');
      this.pendingAction = undefined;
      return this.renew();
    }

    // schedule renewal if logged in
    // TODO: do this cleaner or elsewhere
    if (/*this.status.status === 'logged-in'*/ this.state instanceof LoggedInState) {
      this.initConfiguration.debug && logDebug('Queueing renewal');
      this.scheduleTokenRenewal(this.state);
    }

    this.initConfiguration.debug && logDebug('Processing state', newState.constructor.name);
    newState.process();
  }

  private scheduleTokenRenewal(loggedIn: LoggedInState) {
    // TODO: do we want to schedule a renewal if there's no refresh token? this would involve a login flow, breaking
    //       user interaction
    //       then again, if you don't have refresh tokens enabled, what were you expecting anyway
    const state = loggedIn.state;
    const endpoints = this.endpoints;

    if (endpoints !== undefined) {
      this.tokenRenewal = setTimeout(
        () => this.advanceState(new RenewLoginState(state, state.authCache, endpoints, true)),
        state.authCache.expiresAt - Date.now() - REFRESH_WINDOW,
      );
    }
  }
}

export default AuthClient;
