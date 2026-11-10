import {
  type AuthContext,
  type StateOf,
  type Transition,
  oauthChallengeKey,
  oauthStateKey,
} from './AuthMachineState';

const hasPendingRedirect = (context: AuthContext) =>
  localStorage.getItem(oauthStateKey(context)) !== null &&
  localStorage.getItem(oauthChallengeKey(context)) !== null;

const processRedirectCheck = async ({
  context,
  params: initialParams,
}: StateOf<'redirect-check'>): Transition => {
  const params = initialParams ?? new URLSearchParams(window.location.search);

  if (hasPendingRedirect(context) && params.get('code') != null && params.get('state') != null) {
    return { type: 'incoming-redirect', context, params };
  }
  return { type: 'check-login', context };
};

export default processRedirectCheck;
