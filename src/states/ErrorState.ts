import AuthInternalState, { type AuthState } from './AuthInternalState';
import type Status from '../Status';
import { AuthStatus } from '../Status';

class ErrorState extends AuthInternalState {
  private readonly _errorMessage: string;

  constructor(state: AuthState, error: string) {
    super(state);
    this._errorMessage = error;
  }

  override async process() {
    localStorage.removeItem(this.state.storageKey);
  }

  public override getStatus(): Status {
    return {
      status: AuthStatus.Error,
      error: this.errorMessage,
    };
  }

  get errorMessage(): string {
    return this._errorMessage;
  }
}

export default ErrorState;
