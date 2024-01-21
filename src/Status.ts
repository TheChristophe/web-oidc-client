import type Claims from './Claims';

export const AuthStatus = {
  NotLoggedIn: 'not-logged-in',
  Loading: 'loading',
  LoggedIn: 'logged-in',
  Error: 'error',
} as const;
export type AuthStatus = (typeof AuthStatus)[keyof typeof AuthStatus];

type Authentication = {
  token: string;
};

type Status =
  | {
      status: typeof AuthStatus.NotLoggedIn | typeof AuthStatus.Loading;
      user: undefined;
      auth: undefined;
      error: undefined;
    }
  | {
      status: typeof AuthStatus.LoggedIn;
      user: Claims;
      auth: Authentication;
      error: undefined;
    }
  | {
      status: typeof AuthStatus.Error;
      user: undefined;
      auth: undefined;
      error: string;
    };

export const NOT_LOGGED_IN: Status = {
  status: AuthStatus.NotLoggedIn,
  user: undefined,
  auth: undefined,
  error: undefined,
};
export const LOADING: Status = {
  status: AuthStatus.Loading,
  user: undefined,
  auth: undefined,
  error: undefined,
};
export const ERROR: Status = {
  status: AuthStatus.Error,
  user: undefined,
  auth: undefined,
  error: 'Unknown error occurred',
};

export default Status;
