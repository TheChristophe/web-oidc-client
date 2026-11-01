import { type StateOf, type Transition } from './AuthMachineState';
import { clearStoredLogin } from '../storedLogin';

const processError = async ({ context }: StateOf<'error'>): Transition => {
  clearStoredLogin(context.storageKey, context.authCache);
  return undefined;
};

export default processError;
