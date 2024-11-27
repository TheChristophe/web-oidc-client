import type Configuration from '../Configuration';
import { type Endpoints } from '../Configuration';
import type Status from '../Status';
import { LOADING } from '../Status';
import type AuthCache from '../AuthCache';

type _State = {
  readonly configuration: Configuration;
  readonly storageKey: string;

  endpoints?: Endpoints;
  authCache?: AuthCache;
};
export type AuthState<T extends keyof _State = never> = Omit<_State, T> & Required<Pick<_State, T>>;

/**
 * Abstract class for other states
 */
class AuthInternalState {
  protected state: AuthState;

  constructor(state: AuthState) {
    this.state = state;
  }

  /**
   * Get the current authentication state for users of the AuthClient
   */
  public getStatus(): Status {
    return LOADING;
  }

  /**
   * Get the internal state of the state machine
   */
  public getState(): AuthState {
    return this.state;
  }

  protected get oauthStateKey() {
    return `${this.state.storageKey}.state`;
  }

  protected get oauthChallengeKey() {
    return `${this.state.storageKey}.code_verifier`;
  }

  /**
   * Process the current state
   *
   * This is implemented as a separate method, so it can be called after being assigned to the AuthClient
   */
  public async process(): Promise<AuthInternalState | undefined> {
    return undefined;
  }
}

export default AuthInternalState;
