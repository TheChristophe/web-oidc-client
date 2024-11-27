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
   * RECOMMENDED. The lifetime in seconds of the access token. For example, the value "3600" denotes that the access
   * token will expire in one hour from the time the response was generated. If omitted, the authorization server SHOULD
   * provide the expiration time via other means or document the default value.
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
  /**
   * ID Token value associated with the authenticated session.
   * https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse
   */
  id_token?: string;
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

export type IDToken = {
  /**
   * Issuer Identifier for the Issuer of the response. The iss value is a case-sensitive URL using
   * the https scheme that contains scheme, host, and optionally, port number and path components
   * and no query or fragment components.
   */
  iss: string;
  /**
   * Subject Identifier. A locally unique and never reassigned identifier within the Issuer for the
   * End-User, which is intended to be consumed by the Client, e.g., 24400320 or
   * AItOawmwtWwcT0k51BayewNvutrJUqsvl6qs7A4. It MUST NOT exceed 255 ASCII [RFC20] characters in
   * length. The sub value is a case-sensitive string.
   */
  sub: string;
  /**
   * Audience(s) that this ID Token is intended for. It MUST contain the OAuth 2.0 client_id of the
   * Relying Party as an audience value. It MAY also contain identifiers for other audiences. In the
   * general case, the aud value is an array of case-sensitive strings. In the common special case
   * when there is one audience, the aud value MAY be a single case-sensitive string.
   */
  aud: string;
  /**
   * Expiration time on or after which the ID Token MUST NOT be accepted by the RP when performing
   * authentication with the OP. The processing of this parameter requires that the current
   * date/time MUST be before the expiration date/time listed in the value. Implementers MAY provide
   * for some small leeway, usually no more than a few minutes, to account for clock skew. Its value
   * is a JSON [RFC8259] number representing the number of seconds from 1970-01-01T00:00:00Z as
   * measured in UTC until the date/time. See RFC 3339 [RFC3339] for details regarding date/times in
   * general and UTC in particular. NOTE: The ID Token expiration time is unrelated the lifetime of
   * the authenticated session between the RP and the OP.
   */
  exp: string;
  /**
   * Time at which the JWT was issued. Its value is a JSON number representing the number of seconds
   * from 1970-01-01T00:00:00Z as measured in UTC until the date/time.
   */
  iat: number;
  /**
   * Time when the End-User authentication occurred. Its value is a JSON number representing the
   * number of seconds from 1970-01-01T00:00:00Z as measured in UTC until the date/time. When a
   * max_age request is made or when auth_time is requested as an Essential Claim, then this Claim
   * is REQUIRED; otherwise, its inclusion is OPTIONAL. (The auth_time Claim semantically
   * corresponds to the OpenID 2.0 PAPE [OpenID.PAPE] auth_time response parameter.)
   */
  auth_time?: number;
  /**
   * String value used to associate a Client session with an ID Token, and to mitigate replay
   * attacks. The value is passed through unmodified from the Authentication Request to the ID
   * Token. If present in the ID Token, Clients MUST verify that the nonce Claim Value is equal to
   * the value of the nonce parameter sent in the Authentication Request. If present in the
   * Authentication Request, Authorization Servers MUST include a nonce Claim in the ID Token with
   * the Claim Value being the nonce value sent in the Authentication Request. Authorization Servers
   * SHOULD perform no other processing on nonce values used. The nonce value is a case-sensitive
   * string.
   */
  nonce?: string;
  /**
   * Authentication Context Class Reference. String specifying an Authentication Context Class
   * Reference value that identifies the Authentication Context Class that the authentication
   * performed satisfied. The value "0" indicates the End-User authentication did not meet the
   * requirements of ISO/IEC 29115 [ISO29115] level 1. For historic reasons, the value "0" is used
   * to indicate that there is no confidence that the same person is actually there. Authentications
   * with level 0 SHOULD NOT be used to authorize access to any resource of any monetary value.
   * (This corresponds to the OpenID 2.0 PAPE [OpenID.PAPE] nist_auth_level 0.) An absolute URI or
   * an RFC 6711 [RFC6711] registered name SHOULD be used as the acr value; registered names MUST
   * NOT be used with a different meaning than that which is registered. Parties using this claim
   * will need to agree upon the meanings of the values used, which may be context specific. The acr
   * value is a case-sensitive string.
   */
  acr?: string;
  /**
   * Authentication Methods References. JSON array of strings that are identifiers for
   * authentication methods used in the authentication. For instance, values might indicate that
   * both password and OTP authentication methods were used. The amr value is an array of
   * case-sensitive strings. Values used in the amr Claim SHOULD be from those registered in the
   * IANA Authentication Method Reference Values registry [IANA.AMR] established by [RFC8176];
   * parties using this claim will need to agree upon the meanings of any unregistered values used,
   * which may be context specific.
   */
  amr?: string[];
  /**
   * Authorized party - the party to which the ID Token was issued. If present, it MUST contain the
   * OAuth 2.0 Client ID of this party. The azp value is a case-sensitive string containing a
   * StringOrURI value. Note that in practice, the azp Claim only occurs when extensions beyond the
   * scope of this specification are used; therefore, implementations not using such extensions are
   * encouraged to not use azp and to ignore it when it does occur.
   */
  azp?: string;
};
