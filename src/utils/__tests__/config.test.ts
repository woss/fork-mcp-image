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
    it('should return error when GEMINI_API_KEY is missing', () => {
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
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigError)
        expect(result.error.message).toContain('GEMINI_API_KEY')
        expect(result.error.suggestion).toContain('Set GEMINI_API_KEY')
      }
    })

    it('should return error when GEMINI_API_KEY is too short', () => {
      // Arrange
      const config = {
        imageProvider: 'gemini' as const,
        geminiApiKey: 'short',
        openaiApiKey: '',
        arkApiKey: '',
        imageOutputDir: './output',
        skipPromptEnhancement: false,
        imageQuality: 'fast' as const,
      }

      // Act
      const result = validateConfig(config)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigError)
        expect(result.error.message).toContain('at least 10 characters')
      }
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

    it('should accept OpenAI provider without GEMINI_API_KEY', () => {
      // Arrange
      const config = {
        imageProvider: 'openai' as const,
        geminiApiKey: '',
        openaiApiKey: 'test-openai-api-key-12345',
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

    it('should require OPENAI_API_KEY for OpenAI provider', () => {
      // Arrange
      const config = {
        imageProvider: 'openai' as const,
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
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigError)
        expect(result.error.message).toContain('OPENAI_API_KEY')
      }
    })

    it.each(['', '   '])(
      'should require a trimmed non-empty ARK_API_KEY for the Seedream provider',
      (arkApiKey) => {
        // Arrange
        const config = {
          imageProvider: 'seedream' as const,
          geminiApiKey: '',
          openaiApiKey: '',
          arkApiKey,
          imageOutputDir: './output',
          skipPromptEnhancement: false,
          imageQuality: 'fast' as const,
        }

        // Act
        const result = validateConfig(config)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ConfigError)
          expect(result.error.message).toContain('ARK_API_KEY')
          if (arkApiKey.length > 0) {
            expect(result.error.message).not.toContain(arkApiKey)
          }
        }
      }
    )

    it('should accept a trimmed non-empty ARK_API_KEY without other provider keys', () => {
      // Arrange
      const config = {
        imageProvider: 'seedream' as const,
        geminiApiKey: '',
        openaiApiKey: '',
        arkApiKey: '  test-ark-key  ',
        imageOutputDir: './output',
        skipPromptEnhancement: false,
        imageQuality: 'fast' as const,
      }

      // Act
      const result = validateConfig(config)

      // Assert
      expect(result.success).toBe(true)
    })

    it('should accept a configured non-default provider when the default provider key is missing', () => {
      // Arrange: requests may select openai even though IMAGE_PROVIDER is gemini
      const config = {
        imageProvider: 'gemini' as const,
        geminiApiKey: '',
        openaiApiKey: 'test-openai-api-key-12345',
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

    it('should report the default provider error when no provider key is configured', () => {
      // Arrange
      const config = {
        imageProvider: 'seedream' as const,
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
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigError)
        expect(result.error.message).toContain('ARK_API_KEY')
      }
    })
  })

  describe('validateProviderCredentials', () => {
    const configWithOnlyOpenAIKey = {
      imageProvider: 'gemini' as const,
      geminiApiKey: '',
      openaiApiKey: 'test-openai-api-key-12345',
      arkApiKey: '',
      imageOutputDir: './output',
      skipPromptEnhancement: false,
      imageQuality: 'fast' as const,
    }

    it('should accept the provider whose key is configured', () => {
      // Act
      const result = validateProviderCredentials(configWithOnlyOpenAIKey, 'openai')

      // Assert
      expect(result.success).toBe(true)
    })

    it.each([
      ['gemini' as const, 'GEMINI_API_KEY'],
      ['seedream' as const, 'ARK_API_KEY'],
    ])('should reject %s when its key is missing', (provider, expectedKeyName) => {
      // Act
      const result = validateProviderCredentials(configWithOnlyOpenAIKey, provider)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigError)
        expect(result.error.message).toContain(expectedKeyName)
      }
    })

    it('should reject a key that is shorter than the provider minimum', () => {
      // Arrange
      const config = { ...configWithOnlyOpenAIKey, openaiApiKey: 'short' }

      // Act
      const result = validateProviderCredentials(config, 'openai')

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('OPENAI_API_KEY')
      }
    })
  })

  describe('getConfig', () => {
    it('should return config with default values when environment variables are not set', () => {
      // Arrange - environment variables are undefined by default

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(false) // Should fail because API key is required
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigError)
        expect(result.error.message).toContain('GEMINI_API_KEY')
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

    it('should trim ARK_API_KEY while loading Seedream environment config', () => {
      process.env.IMAGE_PROVIDER = 'seedream'
      process.env.ARK_API_KEY = ' \ttest-ark-api-key\n '

      const result = getConfig()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.arkApiKey).toBe('test-ark-api-key')
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

    it('should validate the loaded config', () => {
      // Arrange
      process.env.GEMINI_API_KEY = 'short' // Invalid short API key

      // Act
      const result = getConfig()

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigError)
        expect(result.error.message).toContain('at least 10 characters')
      }
    })
  })
})
