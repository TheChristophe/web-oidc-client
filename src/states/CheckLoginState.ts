import { type StateOf, type Transition } from './AuthMachineState';
import type AuthCache from '../AuthCache';
import { readStoredLogin } from '../storedLogin';

const hasExpired = (data: AuthCache): boolean => data.expiresAt < Date.now();

const processCheckLogin = async ({ context }: StateOf<'check-login'>): Transition => {
  const cached = readStoredLogin(context.storageKey);
  if (cached != null) {
    if (hasExpired(cached)) {
      return {
        type: 'renew-login',
        context: { ...context, authCache: cached },
        refresh: false,
      };
    }
    return { type: 'logged-in', context: { ...context, authCache: cached } };
  }
  return { type: 'not-logged-in', context };
};

export default processCheckLogin;
