import { type AuthContext, type StateOf, type Transition, errorState } from './AuthMachineState';
import { type Endpoints } from '../Configuration';
import { logWarn } from '../console';
import isJsonResponse from '../isJsonResponse';

class FetchError extends Error {
  constructor(
    message: string,
    public readonly extra?: unknown,
  ) {
    super(message);
  }
}

const endpointsKey = (context: AuthContext) =>
  `${context.storageKey}.${context.configuration.authority}.endpoints`;

function validateOidcWellknown(data: Record<string, unknown>): asserts data is Endpoints {
  if (typeof data['authorization_endpoint'] !== 'string') {
    throw new Error('Missing authorization_endpoint in OIDC well-known');
  }
  if (typeof data['token_endpoint'] !== 'string') {
    throw new Error('Missing token_endpoint in OIDC well-known');
  }
  if (typeof data['revocation_endpoint'] !== 'string') {
    throw new Error('Missing revocation_endpoint in OIDC well-known');
  }
  if (typeof data['userinfo_endpoint'] !== 'string') {
    throw new Error('Missing userinfo_endpoint in OIDC well-known');
  }
}

const fetchEndpoints = async (context: AuthContext): Promise<Endpoints> => {
  let response: Response;
  try {
    response = await fetch(`${context.configuration.authority}/.well-known/openid-configuration`);
  } catch (error: unknown) {
    throw new FetchError('Could not fetch OIDC well-known', error);
  }

  if (!response.ok) {
    if (isJsonResponse(response)) {
      throw new FetchError('OIDC well-known response was not ok', await response.json());
    } else {
      throw new FetchError('OIDC well-known response was not ok', response.status);
    }
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch (error: unknown) {
    throw new FetchError('Could not parse OIDC well-known', error);
  }

  try {
    validateOidcWellknown(data);
  } catch (e: unknown) {
    throw new FetchError('Could not validate required fields from OIDC well-known', e);
  }

  localStorage.setItem(endpointsKey(context), JSON.stringify(data satisfies Endpoints));

  return data;
};

const tryGetStoredEndpoints = (context: AuthContext): Endpoints | null => {
  const key = endpointsKey(context);
  const stored = localStorage.getItem(key);
  if (stored === null) {
    return null;
  }

  try {
    const json = JSON.parse(stored);
    validateOidcWellknown(json);
    return json;
  } catch (e: unknown) {
    logWarn(
      'Stored endpoints look invalid, resetting',
      e instanceof Error ? e.message : 'Unknown error',
      stored,
    );
    localStorage.removeItem(key);
    return null;
  }
};

const processLoadEndpoints = async ({ context }: StateOf<'load-endpoints'>): Transition => {
  const endpoints =
    context.endpoints ?? context.configuration.endpoints ?? tryGetStoredEndpoints(context);
  if (endpoints != null) {
    return { type: 'redirect-check', context: { ...context, endpoints } };
  }

  try {
    const newEndpoints = await fetchEndpoints(context);
    return { type: 'redirect-check', context: { ...context, endpoints: newEndpoints } };
  } catch (e: unknown) {
    // TODO: don't use exception for control flow
    if (e instanceof FetchError) {
      return errorState(context, e.message, e.extra);
    }
    return errorState(context, 'Unknown error while fetching OIDC endpoints', e);
  }
};

export default processLoadEndpoints;
