/**
 * Comprehensive Error Handling Utility
 *
 * Provides consistent error handling, logging, and user-friendly messages
 * across the entire application.
 */

import { Alert } from 'react-native'

export interface AppError {
  code: string
  message: string
  userMessage: string
  originalError?: any
}

/**
 * Error codes for different types of errors
 */
export const ErrorCodes = {
  // Authentication
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_PERMISSION_DENIED: 'AUTH_PERMISSION_DENIED',

  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',

  // Database
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_INSERT_FAILED: 'DB_INSERT_FAILED',
  DB_UPDATE_FAILED: 'DB_UPDATE_FAILED',
  DB_DELETE_FAILED: 'DB_DELETE_FAILED',

  // Storage
  STORAGE_UPLOAD_FAILED: 'STORAGE_UPLOAD_FAILED',
  STORAGE_DOWNLOAD_FAILED: 'STORAGE_DOWNLOAD_FAILED',
  STORAGE_DELETE_FAILED: 'STORAGE_DELETE_FAILED',

  // Audio
  AUDIO_LOAD_FAILED: 'AUDIO_LOAD_FAILED',
  AUDIO_PLAYBACK_FAILED: 'AUDIO_PLAYBACK_FAILED',
  AUDIO_RECORD_FAILED: 'AUDIO_RECORD_FAILED',

  // File
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_INVALID_FORMAT: 'FILE_INVALID_FORMAT',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',

  // General
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
}

/**
 * User-friendly error messages
 */
const errorMessages: Record<string, string> = {
  [ErrorCodes.AUTH_FAILED]: 'Authentication failed. Please try logging in again.',
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCodes.AUTH_PERMISSION_DENIED]: 'You do not have permission to perform this action.',

  [ErrorCodes.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [ErrorCodes.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',

  [ErrorCodes.DB_QUERY_FAILED]: 'Failed to load data. Please try again.',
  [ErrorCodes.DB_INSERT_FAILED]: 'Failed to save data. Please try again.',
  [ErrorCodes.DB_UPDATE_FAILED]: 'Failed to update data. Please try again.',
  [ErrorCodes.DB_DELETE_FAILED]: 'Failed to delete data. Please try again.',

  [ErrorCodes.STORAGE_UPLOAD_FAILED]: 'Failed to upload file. Please try again.',
  [ErrorCodes.STORAGE_DOWNLOAD_FAILED]: 'Failed to download file. Please try again.',
  [ErrorCodes.STORAGE_DELETE_FAILED]: 'Failed to delete file. Please try again.',

  [ErrorCodes.AUDIO_LOAD_FAILED]: 'Failed to load audio. Please try again.',
  [ErrorCodes.AUDIO_PLAYBACK_FAILED]: 'Audio playback failed. Please try again.',
  [ErrorCodes.AUDIO_RECORD_FAILED]: 'Failed to record audio. Please check microphone permissions.',

  [ErrorCodes.FILE_TOO_LARGE]: 'File is too large. Maximum size is 500 MB.',
  [ErrorCodes.FILE_INVALID_FORMAT]: 'Invalid file format. Please select a supported audio file.',
  [ErrorCodes.FILE_NOT_FOUND]: 'File not found. Please try selecting again.',

  [ErrorCodes.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCodes.VALIDATION_ERROR]: 'Please check your input and try again.',
}

/**
 * Handle and log errors consistently
 */
export function handleError(
  error: any,
  context?: string,
  customMessage?: string
): AppError {
  const errorCode = getErrorCode(error)
  const userMessage = customMessage || errorMessages[errorCode] || errorMessages[ErrorCodes.UNKNOWN_ERROR]

  const appError: AppError = {
    code: errorCode,
    message: error?.message || 'Unknown error',
    userMessage,
    originalError: error,
  }

  // Log error for debugging (only in development)
  if (__DEV__) {
    console.error('Error Handler:', {
      context,
      code: appError.code,
      message: appError.message,
      originalError: error,
    })
  }

  return appError
}

/**
 * Determine error code from error object
 */
function getErrorCode(error: any): string {
  if (!error) return ErrorCodes.UNKNOWN_ERROR

  const message = error?.message?.toLowerCase() || ''

  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    return ErrorCodes.NETWORK_ERROR
  }

  if (message.includes('timeout')) {
    return ErrorCodes.NETWORK_TIMEOUT
  }

  // Authentication errors
  if (message.includes('auth') || message.includes('token') || error.code === 'PGRST301') {
    return ErrorCodes.AUTH_FAILED
  }

  if (message.includes('permission') || error.code === 'PGRST401') {
    return ErrorCodes.AUTH_PERMISSION_DENIED
  }

  // Storage errors
  if (message.includes('upload') || message.includes('storage')) {
    return ErrorCodes.STORAGE_UPLOAD_FAILED
  }

  // Audio errors
  if (message.includes('audio') || message.includes('sound')) {
    return ErrorCodes.AUDIO_LOAD_FAILED
  }

  // File errors
  if (message.includes('file size') || message.includes('too large')) {
    return ErrorCodes.FILE_TOO_LARGE
  }

  if (message.includes('format') || message.includes('invalid')) {
    return ErrorCodes.FILE_INVALID_FORMAT
  }

  return ErrorCodes.UNKNOWN_ERROR
}

/**
 * Show user-friendly error alert
 */
export function showErrorAlert(
  error: any,
  title: string = 'Error',
  context?: string
): void {
  const appError = handleError(error, context)

  Alert.alert(
    title,
    appError.userMessage,
    [{ text: 'OK' }]
  )
}

/**
 * Handle async operations with consistent error handling
 */
export async function handleAsync<T>(
  operation: () => Promise<T>,
  context?: string,
  onError?: (error: AppError) => void
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    const appError = handleError(error, context)

    if (onError) {
      onError(appError)
    } else {
      showErrorAlert(appError, 'Error', context)
    }

    return null
  }
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)))
      }
    }
  }

  throw lastError
}
