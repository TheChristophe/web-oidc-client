import type Configuration from '../Configuration';
import { type Endpoints } from '../Configuration';
import type Status from '../Status';
import { LOADING } from '../Status';
import type AuthCache from '../AuthCache';

type AdvanceState = (newState: AuthInternalState) => void;

type Tail<T extends unknown[]> = T extends [unknown, ...infer End] ? End : never;

type _State = {
  readonly configuration: Configuration;
  readonly advanceState: AdvanceState;

  readonly storageKey: string;

  endpoints?: Endpoints;
  authCache?: AuthCache;
};
export type AuthState<T extends keyof _State = never> = Omit<_State, T> & Required<Pick<_State, T>>;

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

  /**
   * Shorthand to advance to a new state
   *
   * @param otherStateClass class object of the next state
   * @param params necessary parameters for the new state
   * @protected
   */
  protected advance<
    T extends {
      new (
        state: AuthState,
        ...p: Tail<ConstructorParameters<T & AuthInternalState>>
      ): InstanceType<T> & AuthInternalState;
    },
  >(otherStateClass: T, ...params: Tail<ConstructorParameters<T & AuthInternalState>>) {
    this.state.advanceState(new otherStateClass(this.state, ...params));
  }

  /**
   * Process the current state
   *
   * This is implemented as a separate method, so it can be called after being assigned to the AuthClient
   */
  public async process() {}
}

export default AuthInternalState;
