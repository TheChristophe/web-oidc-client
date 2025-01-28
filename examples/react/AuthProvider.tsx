import React, {
  type FC,
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

/*
import {
  AuthClient,
  type ConfigEndpoints,
  type InitialConfiguration,
  LOADING,
  type Status,
} from '@thechristophe/web-oidc-client';
 */
import {
  AuthClient,
  type ConfigEndpoints,
  type InitialConfiguration,
  LOADING,
  Status,
} from '../../src/index';

type AuthFunctions = {
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

type AuthContextData = {
  state: Status;
} & AuthFunctions;

const AuthContext = createContext<AuthContextData | undefined>(undefined);

export const useAuth = () => {
  const auth = useContext(AuthContext);
  if (auth === undefined) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return auth;
};

export class OidcConfigError extends Error {}

/**
 * Parse initial configuration from server/build environment
 *
 * This may lack a redirectUrl, which gets filled in the browser using window.location.
 *
 * @param env
 */
const processEnv = (env: {
  OIDC_CLIENT_ID?: string;
  OIDC_REDIRECT_URL?: string;
  OIDC_SCOPES?: string;

  OIDC_AUTHORITY?: string;
  OIDC_ENDPOINTS_AUTHORIZATION?: string;
  OIDC_ENDPOINTS_TOKEN?: string;
  OIDC_ENDPOINTS_USERINFO?: string;
  OIDC_ENDPOINTS_REVOCATION?: string;

  OIDC_AUTO_LOGIN?: string;
}): InitialConfiguration => {
  const {
    OIDC_CLIENT_ID: clientId,
    OIDC_REDIRECT_URL: redirectionUrl,
    OIDC_SCOPES: scopes,

    OIDC_AUTHORITY: authority,
    OIDC_ENDPOINTS_AUTHORIZATION: authorizationUrl,
    OIDC_ENDPOINTS_TOKEN: tokenUrl,
    OIDC_ENDPOINTS_USERINFO: userInfoUrl,
    OIDC_ENDPOINTS_REVOCATION: revocationUrl,

    OIDC_AUTO_LOGIN: autoLogin = 'false',
  } = env;

  if (clientId === undefined) {
    throw new OidcConfigError('OIDC_CLIENT_ID must be set');
  }
  if (scopes === undefined) {
    throw new OidcConfigError('OIDC_SCOPES must be set');
  }

  let endpoints: ConfigEndpoints;
  if (authority) {
    endpoints = {
      authority,
      endpoints: undefined,
    };
  } else {
    if (
      authorizationUrl === undefined ||
      tokenUrl === undefined ||
      userInfoUrl === undefined ||
      revocationUrl === undefined
    ) {
      throw new OidcConfigError('OIDC_AUTHORITY or OIDC_ENDPOINTS_* must be set');
    }
    endpoints = {
      authority: undefined,
      endpoints: {
        authorization_endpoint: authorizationUrl,
        token_endpoint: tokenUrl,
        userinfo_endpoint: userInfoUrl,
        revocation_endpoint: revocationUrl,
      },
    };
  }

  return {
    clientId,
    redirectionUrl,
    scopes,
    ...endpoints,
    autoLogin: autoLogin === 'true',
  };
};

/* vite */
/**
 * Only return value if string
 *
 * Necessary because ImportMetaEnv is effectively Record<string, any>, not Record<string, string>
 * @param value
 */
/*
const string = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
*/

const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<Status>(LOADING);
  const authClient = useRef(
    new AuthClient(
      processEnv({
        /* next.js */
        OIDC_CLIENT_ID: process.env['NEXT_PUBLIC_OIDC_CLIENT_ID'],
        OIDC_REDIRECT_URL: process.env['NEXT_PUBLIC_OIDC_REDIRECT_URL'],
        OIDC_SCOPES: process.env['NEXT_PUBLIC_OIDC_SCOPES'],
        OIDC_AUTHORITY: process.env['NEXT_PUBLIC_OIDC_AUTHORITY'],
        OIDC_ENDPOINTS_AUTHORIZATION: process.env['NEXT_PUBLIC_OIDC_ENDPOINTS_AUTHORIZATION'],
        OIDC_ENDPOINTS_TOKEN: process.env['NEXT_PUBLIC_OIDC_ENDPOINTS_TOKEN'],
        OIDC_ENDPOINTS_USERINFO: process.env['NEXT_PUBLIC_OIDC_ENDPOINTS_USERINFO'],
        OIDC_ENDPOINTS_REVOCATION: process.env['NEXT_PUBLIC_OIDC_ENDPOINTS_REVOCATION'],
        OIDC_AUTO_LOGIN: process.env['NEXT_PUBLIC_OIDC_AUTO_LOGIN'],
        /* vite */
        /*
        OIDC_CLIENT_ID: string(import.meta.env['VITE_OIDC_CLIENT_ID']),
        OIDC_REDIRECT_URL: string(import.meta.env['VITE_OIDC_REDIRECT_URL']),
        OIDC_SCOPES: string(import.meta.env['VITE_OIDC_SCOPES']),
        OIDC_AUTHORITY: string(import.meta.env['VITE_OIDC_AUTHORITY']),
        OIDC_ENDPOINTS_AUTHORIZATION: string(import.meta.env['VITE_OIDC_ENDPOINTS_AUTHORIZATION']),
        OIDC_ENDPOINTS_TOKEN: string(import.meta.env['VITE_OIDC_ENDPOINTS_TOKEN']),
        OIDC_ENDPOINTS_USERINFO: string(import.meta.env['VITE_OIDC_ENDPOINTS_USERINFO']),
        OIDC_ENDPOINTS_REVOCATION: string(import.meta.env['VITE_OIDC_ENDPOINTS_REVOCATION']),
        OIDC_AUTO_LOGIN: string(import.meta.env['VITE_OIDC_AUTO_LOGIN']),
         */
      }),
      (newStatus) => {
        setStatus(newStatus);
      },
    ),
  );

  useEffect(() => {
    authClient.current.browserInit();
  }, []);

  const callbacks: AuthFunctions = {
    // eslint-disable-next-line @typescript-eslint/require-await
    login: async () => authClient.current.login(),
    // eslint-disable-next-line @typescript-eslint/require-await
    logout: async () => authClient.current.logout(),
  };

  return (
    <AuthContext.Provider
      value={{
        state: status,
        ...callbacks,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
