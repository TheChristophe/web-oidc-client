export type Endpoints = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  revocation_endpoint: string;
  end_session_endpoint?: string;
};

export type ConfigEndpoints =
  | {
      authority: string;
      endpoints?: undefined;
    }
  | {
      endpoints: Endpoints;
      authority?: undefined;
    };

type BaseConfig = {
  clientId: string;
  redirectionUrl?: string;
  postLogoutRedirectionUrl?: string;
  scopes: string;
  autoLogin?: boolean;

  debug?: boolean;
};
type Configuration = Required<BaseConfig> & ConfigEndpoints;
export type InitialConfiguration = BaseConfig & ConfigEndpoints;

export default Configuration;
