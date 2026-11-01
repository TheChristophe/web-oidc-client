import {
  type AuthContext,
  type AuthMachineState,
  type StateOf,
  getFullError,
  getStatus,
} from './states/AuthMachineState';
import processState from './states/processState';
import type Configuration from './Configuration';
import { type Endpoints, type InitialConfiguration } from './Configuration';
import type Status from './Status';
import { LOADING } from './Status';
import { logError, logDebug } from './console';
import REFRESH_WINDOW from './refreshWindow';

export type AuthEventHandler = (event: Status) => void;

class AuthClient {
  readonly #initConfiguration: InitialConfiguration;
  #state: AuthMachineState | null = null;
  readonly #eventHandler: AuthEventHandler;
  #status: Status;

  #endpoints?: Endpoints;
  #tokenRenewal: ReturnType<typeof setTimeout> | null = null;

  #cycling: boolean = false;
  #pendingState: (() => AuthMachineState | undefined) | null = null;

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
    this.advanceState({ type: 'load-endpoints', context: this.getInitialState() });

    window.addEventListener('storage', (event) => {
      if (event.key === this.getInitialState().storageKey) {
        // other tab updated auth, reload once the current state is done processing
        this.#enqueue(this.#reload);
      }
    });
  }

  #reload = (): AuthMachineState => ({ type: 'load-endpoints', context: this.getInitialState() });

  /**
   * Move to a new state now, or after the current one is done processing
   *
   * A queued login or logout is never replaced, as it was requested by the user.
   */
  #enqueue(newState: () => AuthMachineState | undefined) {
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

  #newLogin = (): AuthMachineState | undefined =>
    this.#endpoints
      ? {
          type: 'start-oauth',
          context: { ...this.#currentContext(), endpoints: this.#endpoints },
        }
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

  #newLogout = (): AuthMachineState => ({ type: 'logging-out', context: this.#currentContext() });
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

  #newRenew = (): AuthMachineState | undefined =>
    this.#endpoints && this.#state?.type === 'logged-in'
      ? {
          type: 'renew-login',
          context: { ...this.#state.context, endpoints: this.#endpoints },
          refresh: true,
        }
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

  #currentContext(): AuthContext {
    return this.#state?.context ?? this.getInitialState();
  }

  private getInitialState(): AuthContext {
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
  private async advanceState(newState_: AuthMachineState) {
    this.#cycling = true;
    let newState: AuthMachineState | undefined = newState_;
    while (newState !== undefined) {
      this.#initConfiguration.debug && logDebug('Moving to state', newState.type);

      if (newState.type === 'error') {
        logError('Error state:', ...getFullError(newState));
      }

      this.#state = newState;
      this.#endpoints = newState.context.endpoints ?? this.#endpoints;

      const newStatus = getStatus(newState);
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

      this.#status = newStatus;

      // cancel pending renewal
      if (this.#tokenRenewal != null) {
        clearTimeout(this.#tokenRenewal);
        this.#tokenRenewal = null;
      }

      // schedule renewal if logged in
      // TODO: do this cleaner or elsewhere
      if (newState.type === 'logged-in') {
        this.#initConfiguration.debug && logDebug('Queueing renewal');
        this.scheduleTokenRenewal(newState);
      }

      this.#initConfiguration.debug && logDebug('Processing state', newState.type);
      newState = await processState(newState);
      if (newState === undefined && this.#pendingState !== null) {
        newState = this.#pendingState();
        this.#pendingState = null;
      }
    }
    this.#cycling = false;
  }

  private scheduleTokenRenewal(loggedIn: StateOf<'logged-in'>) {
    // TODO: do we want to schedule a renewal if there's no refresh token? this would involve a login flow, breaking
    //       user interaction
    //       then again, if you don't have refresh tokens enabled, what were you expecting anyway
    const { context } = loggedIn;
    const endpoints = this.#endpoints;

    if (endpoints !== undefined) {
      this.#tokenRenewal = setTimeout(
        () =>
          this.#enqueue(() => ({
            type: 'renew-login',
            context: { ...context, endpoints },
            refresh: true,
          })),
        context.authCache.expiresAt - Date.now() - REFRESH_WINDOW,
      );
    }
  }
}

export default AuthClient;
