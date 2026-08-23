import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getConfig, validateConfig, validateProviderCredentials } from '../config'
import { ConfigError } from '../errors'

describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Mock process.env for each test
    process.env = { ...originalEnv }
    delete process.env.IMAGE_PROVIDER
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.ARK_API_KEY
    delete process.env.IMAGE_OUTPUT_DIR
    delete process.env.IMAGE_QUALITY
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('validateConfig', () => {
    it('should validate settings without requiring provider credentials', () => {
      // Arrange
      const config = {
        imageProvider: 'gemini' as const,
        geminiApiKey: '',
        openaiApiKey: '',
        arkApiKey: '',
        imageOutputDir: './output',
        skipPromptEnhancement: false,
        imageQuality: 'fast' as const,
      }

      // Act
      const result = validateConfig(config)

      // Assert
      expect(result.success).toBe(true)
    })

    it('should accept valid imageQuality values', () => {
      // Arrange
      const qualities = ['fast', 'balanced', 'quality'] as const

      for (const quality of qualities) {
        const config = {
          imageProvider: 'gemini' as const,
          geminiApiKey: 'valid-api-key-12345',
          openaiApiKey: '',
          arkApiKey: '',
          imageOutputDir: './output',
          skipPromptEnhancement: false,
          imageQuality: quality,
        }

        // Act
        const result = validateConfig(config)

        // Assert
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid imageQuality value', () => {
      // Arrange
      const config = {
        imageProvider: 'gemini' as const,
        geminiApiKey: 'valid-api-key-12345',
        openaiApiKey: '',
        arkApiKey: '',
        imageOutputDir: './output',
        skipPromptEnhancement: false,
        imageQuality: 'invalid' as any,
      }

      // Act
      const result = validateConfig(config)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigError)
        expect(result.error.message).toContain('Invalid IMAGE_QUALITY')
        expect(result.error.message).toContain('fast')
        expect(result.error.message).toContain('balanced')
        expect(result.error.message).toContain('quality')
      }
    })

    it('should return success for valid config', () => {
      // Arrange
      const config = {
        imageProvider: 'gemini' as const,
        geminiApiKey: 'valid-api-key-12345',
        openaiApiKey: '',
        arkApiKey: '',
        imageOutputDir: './output',
        skipPromptEnhancement: false,
        imageQuality: 'fast' as const,
      }

      // Act
      const result = validateConfig(config)

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(config)
      }
    })
  })

  describe('validateProviderCredentials', () => {
    const configWithoutCredentials = {
      imageProvider: 'gemini' as const,
      geminiApiKey: '',
      openaiApiKey: '',
      arkApiKey: '',
      imageOutputDir: './output',
      skipPromptEnhancement: false,
      imageQuality: 'fast' as const,
    }

    it.each([
      ['gemini' as const, { geminiApiKey: 'x' }],
      ['openai' as const, { openaiApiKey: 'x' }],
      ['seedream' as const, { arkApiKey: 'x' }],
    ])('should accept %s credentials without inferring a key format', (provider, credentials) => {
      // Arrange
      const config = { ...configWithoutCredentials, ...credentials }

      // Act
      const result = validateProviderCredentials(config, provider)

      // Assert
      expect(result.success).toBe(true)
    })

    it.each([
      ['gemini' as const, { geminiApiKey: '' }, 'GEMINI_API_KEY'],
      ['gemini' as const, { geminiApiKey: ' \t\n ' }, 'GEMINI_API_KEY'],
      ['openai' as const, { openaiApiKey: '' }, 'OPENAI_API_KEY'],
      ['openai' as const, { openaiApiKey: ' \t\n ' }, 'OPENAI_API_KEY'],
      ['seedream' as const, { arkApiKey: '' }, 'ARK_API_KEY'],
      ['seedream' as const, { arkApiKey: ' \t\n ' }, 'ARK_API_KEY'],
    ])(
      'should guide the caller when %s credentials are missing',
      (provider, credentials, environmentVariable) => {
        // Arrange
        const config = { ...configWithoutCredentials, ...credentials }

        // Act
        const result = validateProviderCredentials(config, provider)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ConfigError)
          expect(result.error.message).toBe(
            `The selected image provider "${provider}" is not configured on this server.`
          )
          expect(result.error.suggestion).toBe(
            `Ask the user to configure ${environmentVariable} and restart the MCP server. After the server restarts, retry generate_image with provider "${provider}".`
          )
        }
      }
    )
  })

  describe('getConfig', () => {
    it('should return config with default values when environment variables are not set', () => {
      // Arrange - environment variables are undefined by default

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toMatchObject({
          imageProvider: 'gemini',
          geminiApiKey: '',
          openaiApiKey: '',
          arkApiKey: '',
          imageOutputDir: './output',
          imageQuality: 'fast',
        })
      }
    })

    it('should return config with custom IMAGE_OUTPUT_DIR', () => {
      // Arrange
      process.env.GEMINI_API_KEY = 'test-api-key-12345'
      process.env.IMAGE_OUTPUT_DIR = '/custom/output'

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.geminiApiKey).toBe('test-api-key-12345')
        expect(result.data.imageOutputDir).toBe('/custom/output')
      }
    })

    it('should load OpenAI provider config from environment', () => {
      // Arrange
      process.env.IMAGE_PROVIDER = 'openai'
      process.env.OPENAI_API_KEY = 'test-openai-api-key-12345'

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.imageProvider).toBe('openai')
        expect(result.data.openaiApiKey).toBe('test-openai-api-key-12345')
      }
    })

    it('should load the exact Seedream provider and ARK_API_KEY from environment', () => {
      // Arrange
      process.env.IMAGE_PROVIDER = 'seedream'
      process.env.ARK_API_KEY = 'test-ark-api-key'

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.imageProvider).toBe('seedream')
        expect(result.data.arkApiKey).toBe('test-ark-api-key')
      }
    })

    it.each([
      ['GEMINI_API_KEY', 'geminiApiKey' as const],
      ['OPENAI_API_KEY', 'openaiApiKey' as const],
      ['ARK_API_KEY', 'arkApiKey' as const],
    ])('should preserve %s exactly as configured', (environmentVariable, configKey) => {
      // Arrange
      const credential = ' \ttest-api-key\n '
      process.env[environmentVariable] = credential

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data[configKey]).toBe(credential)
      }
    })

    it('should return config with default IMAGE_OUTPUT_DIR when not set', () => {
      // Arrange
      process.env.GEMINI_API_KEY = 'test-api-key-12345'
      // IMAGE_OUTPUT_DIR is undefined

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.geminiApiKey).toBe('test-api-key-12345')
        expect(result.data.imageOutputDir).toBe('./output') // Default value
      }
    })

    it('should return fast as default imageQuality', () => {
      // Arrange
      process.env.GEMINI_API_KEY = 'test-api-key-12345'

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.imageQuality).toBe('fast')
      }
    })

    it('should read IMAGE_QUALITY env var', () => {
      // Arrange
      process.env.GEMINI_API_KEY = 'test-api-key-12345'
      process.env.IMAGE_QUALITY = 'quality'

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.imageQuality).toBe('quality')
      }
    })

    it('should reject invalid IMAGE_QUALITY env var', () => {
      // Arrange
      process.env.GEMINI_API_KEY = 'test-api-key-12345'
      process.env.IMAGE_QUALITY = 'ultra'

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Invalid IMAGE_QUALITY')
      }
    })
  })
})
