export const ERROR_CODES = [
  'consent_required',
  'provider_auth',
  'provider_rate_limit',
  'provider_server',
  'provider_bad_request',
  'network',
  'timeout',
  'validation',
  'verification_failed',
  'compile',
  'not_found',
  'unsupported',
  'cancelled',
  'storage',
  'capture',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface AppError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  detail?: string;
}

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; error: AppError };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

const RETRYABLE: ReadonlySet<ErrorCode> = new Set([
  'provider_rate_limit',
  'provider_server',
  'network',
  'timeout',
]);

export const err = (code: ErrorCode, message: string, detail?: string): Err => ({
  ok: false,
  error: { code, message, retryable: RETRYABLE.has(code), ...(detail === undefined ? {} : { detail }) },
});

/** Plain-language message and suggested action for each error code (used by the UI). */
export const ERROR_HELP: Record<ErrorCode, { message: string; action: string }> = {
  consent_required: {
    message: 'You have not accepted the privacy notice yet.',
    action: 'Read and accept it to continue.',
  },
  provider_auth: { message: 'The provider rejected your API key.', action: 'Check the key in Settings.' },
  provider_rate_limit: {
    message: 'The provider is limiting requests.',
    action: 'Wait a minute and press Retry.',
  },
  provider_server: { message: 'The provider had a problem on its side.', action: 'Press Retry in a moment.' },
  provider_bad_request: {
    message: 'The provider could not process the request.',
    action: 'Try a different model in Settings.',
  },
  network: { message: 'The network request failed.', action: 'Check your connection and press Retry.' },
  timeout: { message: 'The request took too long.', action: 'Press Retry or choose a faster model.' },
  validation: {
    message: 'The result did not match the expected format.',
    action: 'Press Retry. If it repeats, try a stronger model.',
  },
  verification_failed: {
    message: 'A bullet could not be verified against your projects.',
    action: 'Edit or remove the bullet.',
  },
  compile: {
    message: 'The resume could not be built into a PDF.',
    action: 'Check the error line shown, then edit and rebuild.',
  },
  not_found: { message: 'The item was not found.', action: 'Check the name and try again.' },
  unsupported: { message: 'This file or action is not supported.', action: 'Choose a different file.' },
  cancelled: { message: 'The run was cancelled.', action: 'Start it again when ready.' },
  capture: {
    message: 'This page could not be read.',
    action: 'Open the job posting tab, or paste the text instead.',
  },
  storage: { message: 'Saving data on this device failed.', action: 'Free some space or clear old history.' },
};
