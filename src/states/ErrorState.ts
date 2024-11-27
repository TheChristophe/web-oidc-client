import AuthInternalState, { type AuthState } from './AuthInternalState';
import type Status from '../Status';
import { AuthStatus } from '../Status';

class ErrorState extends AuthInternalState {
  private readonly _errorMessage: string;
  private readonly _extra?: unknown;

  constructor(state: AuthState, error: string, e?: unknown) {
    super(state);
    this._errorMessage = error;
    if (e != null) {
      this._extra = e instanceof Error ? e.message : e;
    }
  }

  override async process() {
    localStorage.removeItem(this.state.storageKey);
    return undefined;
  }

  public override getStatus(): Status {
    return {
      status: AuthStatus.Error,
      error: this._errorMessage,
    };
  }

  getFullError(): [string, unknown?] {
    if (this._extra) {
      return [this._errorMessage, this._extra];
    }
    return [this._errorMessage];
  }
}

export default ErrorState;
