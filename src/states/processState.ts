import { type AuthMachineState, type Transition, assertNever } from './AuthMachineState';
import processCheckLogin from './CheckLoginState';
import processError from './ErrorState';
import processIncomingRedirect from './IncomingRedirectState';
import processLoadEndpoints from './LoadEndpointsState';
import processLoggingOut from './LoggingOutState';
import processNotLoggedIn from './NotLoggedInState';
import processRedirectCheck from './RedirectCheckState';
import processRenewLogin from './RenewLoginState';
import processStartOauth from './StartOauthState';

/**
 * Run the side effects of a state and compute the next one
 */
const processState = async (state: AuthMachineState): Transition => {
  switch (state.type) {
    case 'load-endpoints':
      return processLoadEndpoints(state);
    case 'redirect-check':
      return processRedirectCheck(state);
    case 'incoming-redirect':
      return processIncomingRedirect(state);
    case 'check-login':
      return processCheckLogin(state);
    case 'renew-login':
      return processRenewLogin(state);
    case 'start-oauth':
      return processStartOauth(state);
    case 'logging-out':
      return processLoggingOut(state);
    case 'not-logged-in':
      return processNotLoggedIn(state);
    case 'error':
      return processError(state);
    case 'logged-in':
      // wait for a renewal, logout or another tab to change things
      return undefined;
    default:
      return assertNever(state);
  }
};

export default processState;
