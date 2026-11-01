import { type StateOf, type Transition } from './AuthMachineState';
import { clearStoredLogin } from '../storedLogin';

const processNotLoggedIn = async ({ context }: StateOf<'not-logged-in'>): Transition => {
  clearStoredLogin(context.storageKey, context.authCache);
  return undefined;
};

export default processNotLoggedIn;
