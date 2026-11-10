import type Configuration from '../Configuration';
import { type Endpoints } from '../Configuration';
import type Status from '../Status';
import { AuthStatus, LOADING } from '../Status';
import type AuthCache from '../AuthCache';

type _Context = {
  readonly configuration: Configuration;
  readonly storageKey: string;

  endpoints?: Endpoints;
  authCache?: AuthCache;
};

/**
 * Data shared by all states, with the fields in `T` guaranteed to be set
 */
export type AuthContext<T extends keyof _Context = never> = Omit<_Context, T> &
  Required<Pick<_Context, T>>;

/**
 * All states of the auth state machine
 *
 * Each state is a plain object tagged by `type`, carrying only the data it needs.
 */
export type AuthMachineState =
  | {
      readonly type: 'load-endpoints';
      readonly context: AuthContext;
      readonly params?: URLSearchParams;
    }
  | {
      readonly type: 'redirect-check';
      readonly context: AuthContext<'endpoints'>;
      readonly params?: URLSearchParams;
    }
  | {
      readonly type: 'incoming-redirect';
      readonly context: AuthContext<'endpoints'>;
      readonly params: URLSearchParams;
    }
  | { readonly type: 'check-login'; readonly context: AuthContext<'endpoints'> }
  | {
      readonly type: 'renew-login';
      readonly context: AuthContext<'endpoints' | 'authCache'>;
      /**
       * Whether this renews a still valid login, keeping the user logged in meanwhile
       */
      readonly refresh: boolean;
    }
  | { readonly type: 'start-oauth'; readonly context: AuthContext<'endpoints'> }
  | { readonly type: 'logged-in'; readonly context: AuthContext<'authCache'> }
  | { readonly type: 'logging-out'; readonly context: AuthContext }
  | { readonly type: 'not-logged-in'; readonly context: AuthContext }
  | {
      readonly type: 'error';
      readonly context: AuthContext;
      readonly error: string;
      readonly extra?: unknown;
    };

export type AuthStateType = AuthMachineState['type'];

/**
 * The state with the given `type`
 */
export type StateOf<T extends AuthStateType> = Extract<AuthMachineState, { type: T }>;

/**
 * Result of processing a state: the next state, or `undefined` to wait for outside input
 */
export type Transition = Promise<AuthMachineState | undefined>;

export const errorState = (
  context: AuthContext,
  error: string,
  extra?: unknown,
): StateOf<'error'> => ({
  type: 'error',
  context,
  error,
  extra: extra instanceof Error ? extra.message : (extra ?? undefined),
});

export const getFullError = (state: StateOf<'error'>): [string, unknown?] =>
  state.extra ? [state.error, state.extra] : [state.error];

export const loggedInStatus = (authCache: AuthCache): Status => ({
  status: AuthStatus.LoggedIn,
  user: authCache.user,
  auth: {
    token: authCache.tokenResponse.access_token,
  },
});

/**
 * Get the current authentication status for users of the AuthClient
 */
export const getStatus = (state: AuthMachineState): Status => {
  switch (state.type) {
    case 'logged-in':
      return loggedInStatus(state.context.authCache);
    case 'renew-login':
      // keep the cached login while refreshing, as it's not likely to have expired yet (5-min window)
      return state.refresh ? loggedInStatus(state.context.authCache) : LOADING;
    case 'not-logged-in':
      return { status: AuthStatus.NotLoggedIn };
    case 'error':
      return { status: AuthStatus.Error, error: state.error };
    case 'load-endpoints':
    case 'redirect-check':
    case 'incoming-redirect':
    case 'check-login':
    case 'start-oauth':
    case 'logging-out':
      return LOADING;
    default:
      return assertNever(state);
  }
};

export const assertNever = (value: never): never => {
  throw new Error(`Unhandled state: ${JSON.stringify(value)}`);
};

export const oauthStateKey = (context: AuthContext) => `${context.storageKey}.state`;

export const oauthChallengeKey = (context: AuthContext) => `${context.storageKey}.code_verifier`;
