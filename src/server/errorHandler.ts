import { buildErrorResponse } from '../business/responseBuilder.js'
import type { McpToolResponse } from '../types/mcp.js'
import type { Result } from '../types/result.js'
import { Err, Ok } from '../types/result.js'
import { Logger } from '../utils/logger.js'

const INTERNAL_ERROR_FALLBACK = {
  code: 'INTERNAL_ERROR',
  suggestion: 'Contact system administrator',
} as const

const logger = new Logger()

function handleError(error: Error): McpToolResponse {
  logger.error('error-handler', 'Error occurred', error, {
    errorType: error.constructor.name,
    stack: error.stack,
  })

  return buildErrorResponse(error, INTERNAL_ERROR_FALLBACK)
}

async function wrapWithResultType<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<Result<T, Error>> {
  try {
    const result = await operation()
    return Ok(result)
  } catch (error) {
    const finalError = error instanceof Error ? error : new Error('Unknown error')

    if (context) {
      logger.error(context, 'Operation failed', finalError)
    }

    return Err(finalError)
  }
}

export const ErrorHandler = {
  handleError,
  wrapWithResultType,
} as const
