import {
  type FC,
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import AuthClient from '../../src/AuthClient';
import { type ConfigEndpoints, type InitialConfiguration } from '../../src/Configuration';
import type Status from '../../src/Status';
import { LOADING } from '../../src/Status';

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

/**
 * Parse initial configuration from server/build environment
 *
 * This may lack a redirectUrl, which gets filled in the browser using window.location.
 *
 * @param env
 */
const processEnv = (env: Record<string, string | undefined>): InitialConfiguration => {
  const {
    NEXT_PUBLIC_OIDC_CLIENT_ID: clientId,
    NEXT_PUBLIC_OIDC_REDIRECT_URL: redirectionUrl,
    NEXT_PUBLIC_OIDC_SCOPES: scopes,

    NEXT_PUBLIC_OIDC_AUTHORITY: authority,
    NEXT_PUBLIC_OIDC_ENDPOINTS_AUTHORIZATION: authorizationUrl,
    NEXT_PUBLIC_OIDC_ENDPOINTS_TOKEN: tokenUrl,
    NEXT_PUBLIC_OIDC_ENDPOINTS_USERINFO: userInfoUrl,
    NEXT_PUBLIC_OIDC_ENDPOINTS_REVOCATION: revocationUrl,

    NEXT_PUBLIC_OIDC_AUTO_LOGIN: autoLogin = 'true',
  } = env;

  if (clientId === undefined) {
    throw new Error('NEXT_PUBLIC_OIDC_CLIENT_ID must be set');
  }
  if (scopes === undefined) {
    throw new Error('NEXT_PUBLIC_OIDC_SCOPES must be set');
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
      throw new Error('NEXT_PUBLIC_OIDC_AUTHORITY or NEXT_PUBLIC_OIDC_ENDPOINTS_* must be set');
    }
    endpoints = {
      authority: undefined,
      endpoints: {
        authorization: authorizationUrl,
        token: tokenUrl,
        userinfo: userInfoUrl,
        revocation: revocationUrl,
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

const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<Status>(LOADING);
  const authClient = useRef(
    new AuthClient(
      processEnv({
        NEXT_PUBLIC_OIDC_CLIENT_ID: process.env['NEXT_PUBLIC_OIDC_CLIENT_ID'],
        NEXT_PUBLIC_OIDC_REDIRECT_URL: process.env['NEXT_PUBLIC_OIDC_REDIRECT_URL'],
        NEXT_PUBLIC_OIDC_SCOPES: process.env['NEXT_PUBLIC_OIDC_SCOPES'],
        NEXT_PUBLIC_OIDC_AUTHORITY: process.env['NEXT_PUBLIC_OIDC_AUTHORITY'],
        NEXT_PUBLIC_OIDC_ENDPOINTS_AUTHORIZATION:
          process.env['NEXT_PUBLIC_OIDC_ENDPOINTS_AUTHORIZATION'],
        NEXT_PUBLIC_OIDC_ENDPOINTS_TOKEN: process.env['NEXT_PUBLIC_OIDC_ENDPOINTS_TOKEN'],
        NEXT_PUBLIC_OIDC_ENDPOINTS_USERINFO: process.env['NEXT_PUBLIC_OIDC_ENDPOINTS_USERINFO'],
        NEXT_PUBLIC_OIDC_ENDPOINTS_REVOCATION: process.env['NEXT_PUBLIC_OIDC_ENDPOINTS_REVOCATION'],
        NEXT_PUBLIC_OIDC_AUTO_LOGIN: process.env['NEXT_PUBLIC_OIDC_AUTO_LOGIN'],
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
    // TODO: remove async
    login: async () => authClient.current.login(),
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
