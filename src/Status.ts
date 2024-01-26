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
    }
  | {
      status: typeof AuthStatus.LoggedIn;
      user: Claims;
      auth: Authentication;
    }
  | {
      status: typeof AuthStatus.Error;
      error: string;
    };

export const NOT_LOGGED_IN: Status = {
  status: AuthStatus.NotLoggedIn,
};
export const LOADING: Status = {
  status: AuthStatus.Loading,
};
export const ERROR: Status = {
  status: AuthStatus.Error,
  error: 'Unknown error occurred',
};

export default Status;
