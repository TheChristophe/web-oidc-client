export type OidcWellknownEndpoints = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  revocation_endpoint: string;
};

export type Endpoints = {
  authorization: string;
  token: string;
  revocation: string;
  userinfo: string;
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
  scopes: string;
  autoLogin?: boolean;
};
type Configuration = Required<BaseConfig> & ConfigEndpoints;
export type InitialConfiguration = BaseConfig & ConfigEndpoints;

export default Configuration;
