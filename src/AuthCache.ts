import { type TokenResponse } from './oauthTypes';
import type StandardClaims from './Claims';

type AuthCache<Claims extends { sub: string } = StandardClaims> = {
  /**
   * The response from the token endpoint
   */
  tokenResponse: TokenResponse;

  /**
   * OIDC userinfo claims
   */
  user: Claims;

  /**
   * Unix timestamp of when the token expires, in milliseconds
   */
  expiresAt: number;
};

export default AuthCache;
