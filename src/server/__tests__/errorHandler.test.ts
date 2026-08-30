import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FileOperationError,
  GeminiAPIError,
  InputValidationError,
  NetworkError,
} from '../../utils/errors'
import { ErrorHandler } from '../errorHandler'

vi.mock('../../utils/logger', () => ({
  Logger: class {
    error = vi.fn()
    warn = vi.fn()
    info = vi.fn()
  },
  sanitizeText: (input: string) => input,
}))

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleError', () => {
    it.each([
      [
        new InputValidationError('Prompt is too long', 'Prompt length must be 1-4000 characters'),
        'INPUT_VALIDATION_ERROR',
        'Prompt length must be 1-4000 characters',
      ],
      [
        new GeminiAPIError('API quota exceeded', 'Check GEMINI_API_KEY environment variable', 429),
        'GEMINI_API_ERROR',
        'Check GEMINI_API_KEY environment variable',
      ],
      [
        new NetworkError(
          'Network request failed',
          'Check internet connection and retry',
          new Error('Connection timeout')
        ),
        'NETWORK_ERROR',
        'Check internet connection and retry',
      ],
      [
        new FileOperationError('Failed to save image: Permission denied'),
        'FILE_OPERATION_ERROR',
        'Check file and directory permissions for the output path',
      ],
    ])('preserves structured %s errors', (error, code, suggestion) => {
      const response = ErrorHandler.handleError(error)
      const body = JSON.parse(response.content[0].text)

      expect(response.isError).toBe(true)
      expect(body.error).toMatchObject({ code, message: error.message, suggestion })
    })

    it('should handle unknown Error types', () => {
      const error = new Error('Unknown error occurred')

      const response = ErrorHandler.handleError(error)

      expect(response).toMatchObject({
        isError: true,
        content: [
          {
            type: 'text',
            text: expect.stringContaining('"INTERNAL_ERROR"'),
          },
        ],
      })
      expect(response.content[0].text).toContain('Unknown error occurred')
      expect(response.content[0].text).toContain('Contact system administrator')
    })
  })

  describe('wrapWithResultType', () => {
    it('should return Ok result for successful operation', async () => {
      const successOperation = vi.fn().mockResolvedValue('success result')

      const result = await ErrorHandler.wrapWithResultType(successOperation)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('success result')
      }
      expect(successOperation).toHaveBeenCalledOnce()
    })

    it('should return Err result for failed operation', async () => {
      const error = new Error('Operation failed')
      const failedOperation = vi.fn().mockRejectedValue(error)

      const result = await ErrorHandler.wrapWithResultType(failedOperation)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(error)
      }
      expect(failedOperation).toHaveBeenCalledOnce()
    })

    it('should handle non-Error thrown values', async () => {
      const nonErrorValue = 'string error'
      const failedOperation = vi.fn().mockRejectedValue(nonErrorValue)

      const result = await ErrorHandler.wrapWithResultType(failedOperation)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toBe('Unknown error')
      }
    })
  })
})
