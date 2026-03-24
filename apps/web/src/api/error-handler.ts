import { AxiosError } from 'axios';
import type { ApiErrorResponse } from './types';

export class ApiError extends Error {
  public readonly status: number;
  public readonly details: Record<string, string[]> | undefined;

  constructor(message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Extracts a user-friendly message from an Axios error.
 */
export function parseApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof AxiosError && error.response) {
    const data = error.response.data as ApiErrorResponse | undefined;
    const message = data?.message ?? error.message;
    const status = error.response.status;
    const details = data?.details;
    return new ApiError(message, status, details);
  }

  if (error instanceof AxiosError && error.request) {
    return new ApiError(
      'Unable to reach the server. Please check your connection.',
      0,
    );
  }

  const fallback =
    error instanceof Error ? error.message : 'An unexpected error occurred.';
  return new ApiError(fallback, 0);
}

/**
 * Returns the first validation message for a field, if present.
 */
export function getFieldError(
  error: ApiError | null,
  field: string,
): string | undefined {
  return error?.details?.[field]?.[0];
}
