// ── Request DTOs ──

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface VerifyEmailRequest {
  email: string;
  verificationCode: string;
}

export interface ResendCodeRequest {
  email: string;
}

// ── Response DTOs ──

export interface LoginResponse {
  token: string;
  expiresIn: number;
}

export interface SignupResponse {
  id: number;
  fullName: string;
  email: string;
}

// ── Error DTOs ──

export interface ApiError {
  status: number;
  message: string;
  timestamp: string;
}

export interface ApiValidationError extends ApiError {
  fieldErrors: Record<string, string>;
}

export function isValidationError(error: unknown): error is ApiValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'fieldErrors' in error &&
    typeof (error as ApiValidationError).fieldErrors === 'object'
  );
}
