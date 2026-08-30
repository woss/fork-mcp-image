import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Logger } from '../logger'

const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('Logger', () => {
  let logger: Logger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = new Logger()
  })

  describe('info logging', () => {
    it('should log info message with structured format', () => {
      const context = 'test-context'
      const message = 'Test info message'
      const metadata = { key: 'value', count: 42 }

      logger.info(context, message, metadata)

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"level":"info"'))
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('"context":"test-context"')
      )
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test info message"')
      )
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('"metadata":{"key":"value","count":42}')
      )
    })

    it('should log info message without metadata', () => {
      const context = 'test-context'
      const message = 'Test info message'

      logger.info(context, message)

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"level":"info"'))
      expect(mockConsoleError).toHaveBeenCalledWith(expect.not.stringContaining('"metadata"'))
    })
  })

  describe('warn logging', () => {
    it('should log warn message with structured format', () => {
      const context = 'validation'
      const message = 'Invalid input detected'
      const metadata = { field: 'prompt', value: 'test' }

      logger.warn(context, message, metadata)

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"level":"warn"'))
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('"context":"validation"')
      )
    })
  })

  describe('error logging', () => {
    it('should log error message with error details', () => {
      const context = 'api-call'
      const message = 'API call failed'
      const error = new Error('Network timeout')
      const metadata = { endpoint: '/generate', retries: 3 }

      logger.error(context, message, error, metadata)

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"level":"error"'))
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"context":"api-call"'))
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('"message":"API call failed"')
      )
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('"errorMessage":"Network timeout"')
      )
    })

    it('should log error message without error object', () => {
      const context = 'processing'
      const message = 'Processing failed'

      logger.error(context, message)

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"level":"error"'))
      expect(mockConsoleError).toHaveBeenCalledWith(expect.not.stringContaining('"errorMessage"'))
    })
  })

  describe('sensitive data filtering', () => {
    it('should redact all sensitive field patterns', () => {
      const sensitiveFields = [
        'API_KEY',
        'apiKey',
        'api_key',
        'SECRET',
        'secret',
        'PASSWORD',
        'password',
        'TOKEN',
        'token',
        'CREDENTIAL',
        'credential',
      ]

      for (const field of sensitiveFields) {
        const metadata = {
          [field]: 'sensitive-value',
          normalField: 'normal-value',
        }

        logger.info('test', 'message', metadata)

        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"[REDACTED]"'))
        expect(mockConsoleError).toHaveBeenCalledWith(
          expect.not.stringContaining('sensitive-value')
        )
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('normal-value'))

        vi.clearAllMocks()
      }
    })

    it('should handle nested sensitive data', () => {
      const metadata = {
        config: {
          apiKey: 'secret-key',
          endpoint: 'https://api.example.com',
        },
        user: {
          id: 123,
          password: 'user-password',
        },
      }

      logger.info('test', 'nested data', metadata)

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"[REDACTED]"'))
      expect(mockConsoleError).toHaveBeenCalledWith(expect.not.stringContaining('secret-key'))
      expect(mockConsoleError).toHaveBeenCalledWith(expect.not.stringContaining('user-password'))
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('[URL_REDACTED]'))
    })

    it.each([
      ['GEMINI_API_KEY', 'AIzaSyABCDEF123456789'],
      ['OPENAI_API_KEY', 'sk-proj-ABCDEF123456789'],
    ])('redacts %s in environment variable format', (name, secret) => {
      logger.info('config', `Starting service with ${name}=${secret}`)

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('[REDACTED]'))
      expect(mockConsoleError).toHaveBeenCalledWith(expect.not.stringContaining(secret))
    })

    it('should redact Seedream credentials and sensitive request data', () => {
      const sensitiveValues = {
        arkApiKey: 'ark-dummy-key',
        authorization: 'bearer-dummy-token',
        prompt: 'private prompt value',
        image: 'private-image-value',
        requestBody: 'private-request-body',
        responseBody: 'private-response-body',
      }
      const message = [
        `ARK_API_KEY=${sensitiveValues.arkApiKey}`,
        `Authorization: Bearer ${sensitiveValues.authorization}`,
        `prompt="${sensitiveValues.prompt}"`,
        `image="${sensitiveValues.image}"`,
        `request_body="${sensitiveValues.requestBody}"`,
      ].join(' ')
      const error = new Error(`response_body="${sensitiveValues.responseBody}"`)

      logger.error('seedream', message, error, {
        prompt: sensitiveValues.prompt,
        image: sensitiveValues.image,
        rawBody: sensitiveValues.requestBody,
        authorization: `Bearer ${sensitiveValues.authorization}`,
      })

      const logOutput = mockConsoleError.mock.calls[0][0]
      expect(logOutput).toContain('[REDACTED]')
      for (const sensitiveValue of Object.values(sensitiveValues)) {
        expect(logOutput).not.toContain(sensitiveValue)
      }
    })

    it.each([
      ['https://api.example.com/v1/data?key=secret', '[URL_REDACTED]'],
      ['4532-1234-5678-9012', '[FILTERED]'],
      ['user@example.com', '[FILTERED]'],
      ['+1-555-123-4567', '[FILTERED]'],
      ['123-45-6789', '[FILTERED]'],
    ])('redacts message value %s', (sensitiveValue, replacement) => {
      logger.info('test', `Message containing ${sensitiveValue}`)

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining(replacement))
      expect(mockConsoleError).toHaveBeenCalledWith(expect.not.stringContaining(sensitiveValue))
    })
  })

  describe('debug logging', () => {
    const originalNodeEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
    })

    it('should log debug message in development mode', () => {
      process.env.NODE_ENV = 'development'
      const context = 'debug-test'
      const message = 'Debug message'
      const metadata = { debug: true }

      logger.debug(context, message, metadata)

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"level":"debug"'))
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('"context":"debug-test"')
      )
    })

    it('should not log debug message in production mode', () => {
      process.env.NODE_ENV = 'production'
      const context = 'debug-test'
      const message = 'Debug message'

      logger.debug(context, message)

      expect(mockConsoleError).not.toHaveBeenCalled()
    })
  })

  describe('trace and session IDs', () => {
    it('should include traceId and sessionId in log entries', () => {
      const context = 'trace-test'
      const message = 'Test message with trace'

      logger.info(context, message)

      const logOutput = mockConsoleError.mock.calls[0][0]
      const parsedLog = JSON.parse(logOutput)

      expect(parsedLog).toHaveProperty('traceId')
      expect(parsedLog).toHaveProperty('sessionId')
      expect(typeof parsedLog.traceId).toBe('string')
      expect(typeof parsedLog.sessionId).toBe('string')
    })
  })

  describe('error logging with stack traces', () => {
    const originalNodeEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
    })

    it('should include error stack in development mode', () => {
      process.env.NODE_ENV = 'development'
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at Object.<anonymous> (test.js:1:1)'

      logger.error('test', 'Error occurred', error)

      const logOutput = mockConsoleError.mock.calls[0][0]
      const parsedLog = JSON.parse(logOutput)

      expect(parsedLog.metadata).toHaveProperty('errorStack')
      expect(parsedLog.metadata.errorStack).toContain('Error: Test error')
    })

    it('should not include error stack in production mode', () => {
      process.env.NODE_ENV = 'production'
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at Object.<anonymous> (test.js:1:1)'

      logger.error('test', 'Error occurred', error)

      const logOutput = mockConsoleError.mock.calls[0][0]
      const parsedLog = JSON.parse(logOutput)

      expect(parsedLog.metadata?.errorStack).toBeUndefined()
    })
  })

  describe('timestamp format', () => {
    it('should include ISO timestamp in log entries', () => {
      const beforeTime = new Date().toISOString()

      logger.info('test', 'timestamp test')

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"timestamp":"'))

      const logCall = mockConsoleError.mock.calls[0][0]
      const timestampMatch = logCall.match(/"timestamp":"([^"]+)"/)
      expect(timestampMatch).not.toBeNull()

      if (timestampMatch) {
        const timestamp = timestampMatch[1]
        expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime())
      }
    })
  })

  describe('log entry structure', () => {
    it('should produce valid JSON log entries', () => {
      const context = 'json-test'
      const message = 'Valid JSON test'
      const metadata = { test: true, count: 1 }

      logger.info(context, message, metadata)

      const logOutput = mockConsoleError.mock.calls[0][0]
      const parsedLog = JSON.parse(logOutput)
      expect(parsedLog).toMatchObject({
        timestamp: expect.any(String),
        level: 'info',
        context: 'json-test',
        message: 'Valid JSON test',
        metadata: { test: true, count: 1 },
      })
    })
  })
})
