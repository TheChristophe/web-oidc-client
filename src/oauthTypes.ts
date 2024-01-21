/**
 * https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
 */
export type TokenResponse = {
  /**
   * The access token issued by the authorization server.
   */
  access_token: string;
  /**
   * The type of the token issued as described in Section 7.1. Value is case-insensitive.
   */
  token_type: string;
  /**
   * The lifetime in seconds of the access token. For example, the value "3600" denotes that the access token will
   * expire in one hour from the time the response was generated. If omitted, the authorization server SHOULD provide
   * the expiration time via other means or document the default value.
   */
  expires_in?: number;
  /**
   * The refresh token, which can be used to obtain new access tokens using the same authorization grant as described
   * in Section 6.
   */
  refresh_token?: string;
  /**
   * OPTIONAL, if identical to the scope requested by the client; otherwise, REQUIRED.  The scope of the access
   * token as described by Section 3.3.
   */
  scope?: string;
};
export type WorkingTokenResponse = TokenResponse & {
  expires_in: number;
};

type TokenError =
  /**
   * The request is missing a required parameter, includes an unsupported parameter value (other than grant type),
   * repeats a parameter, includes multiple credentials, utilizes more than one mechanism for authenticating the client,
   * or is otherwise malformed.
   */
  | 'invalid_request'
  /**
   * Client authentication failed (e.g., unknown client, no client authentication included, or unsupported
   * authentication method).  The authorization server MAY return an HTTP 401 (Unauthorized) status code to indicate
   * which HTTP authentication schemes are supported.  If the client attempted to authenticate via the
   * "Authorization" request header field, the authorization server MUST respond with an HTTP 401 (Unauthorized)
   * status code and include the "WWW-Authenticate" response header field matching the authentication scheme used by
   * the client.
   */
  | 'invalid_client'
  /**
   * The provided authorization grant (e.g., authorization code, resource owner credentials) or refresh token is
   * invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued
   * to another client.
   */
  | 'invalid_grant'
  /**
   * The authenticated client is not authorized to use this authorization grant type.
   */
  | 'unauthorized_client'
  /**
   * The authorization grant type is not supported by the authorization server.
   */
  | 'unsupported_grant_type'
  /**
   * The requested scope is invalid, unknown, malformed, or exceeds the scope granted by the resource owner.
   */
  | 'invalid_scope';
/**
 *
 */
export type TokenErrorResponse = {
  /**
   * A single ASCII [USASCII] error code from the following: (see type TokenError)
   */
  error: TokenError;

  /**
   * Human-readable ASCII [USASCII] text providing additional information, used to assist the client developer in
   * understanding the error that occurred. Values for the "error_description" parameter MUST NOT include characters
   * outside the set %x20-21 / %x23-5B / %x5D-7E.
   */
  error_description?: string;

  /**
   * A URI identifying a human-readable web page with information about the error, used to provide the client developer
   * with additional information about the error. Values for the "error_uri" parameter MUST conform to the
   * URI-reference syntax and thus MUST NOT include characters outside the set %x21 / %x23-5B / %x5D-7E.
   */
  error_uri?: string;
};
