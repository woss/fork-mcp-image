/**
 * Configuration management for MCP server
 * Handles environment variables and configuration validation
 */

import type { ImageProvider, ImageQuality } from '../types/mcp.js'
import { IMAGE_PROVIDER_VALUES, IMAGE_QUALITY_VALUES } from '../types/mcp.js'
import type { Result } from '../types/result.js'
import { Err, Ok } from '../types/result.js'
import { ConfigError } from './errors.js'

/**
 * Configuration interface
 */
export interface Config {
  imageProvider: ImageProvider
  geminiApiKey: string
  openaiApiKey: string
  arkApiKey: string
  imageOutputDir: string
  skipPromptEnhancement: boolean // Skip prompt enhancement for direct control
  imageQuality: ImageQuality
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  imageProvider: 'gemini',
  imageOutputDir: './output',
} as const

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value || value === 'undefined' || value === 'null') {
    return undefined
  }
  return value
}

/**
 * Validates the API credentials required by a single image provider.
 *
 * Provider selection is a per-request concern, so this check runs when a
 * provider is actually used rather than only at startup.
 * @param config The configuration holding the provider API keys
 * @param provider The provider whose credentials should be validated
 * @returns Result containing the config or ConfigError
 */
export function validateProviderCredentials(
  config: Config,
  provider: ImageProvider
): Result<Config, ConfigError> {
  // Validate GEMINI_API_KEY only when Gemini is the selected provider.
  if (provider === 'gemini') {
    if (!config.geminiApiKey || config.geminiApiKey.trim().length === 0) {
      return Err(
        new ConfigError(
          'GEMINI_API_KEY is required but not provided',
          'Set GEMINI_API_KEY environment variable with your Google AI API key'
        )
      )
    }

    if (config.geminiApiKey.length < 10) {
      return Err(
        new ConfigError(
          'GEMINI_API_KEY appears to be invalid - must be at least 10 characters',
          'Set the GEMINI_API_KEY environment variable to your valid Google AI API key'
        )
      )
    }
  }

  // Validate OPENAI_API_KEY only when OpenAI is the selected provider.
  if (provider === 'openai') {
    if (!config.openaiApiKey || config.openaiApiKey.trim().length === 0) {
      return Err(
        new ConfigError(
          'OPENAI_API_KEY is required but not provided',
          'Set OPENAI_API_KEY environment variable with your OpenAI API key'
        )
      )
    }

    if (config.openaiApiKey.length < 10) {
      return Err(
        new ConfigError(
          'OPENAI_API_KEY appears to be invalid - must be at least 10 characters',
          'Set the OPENAI_API_KEY environment variable to your valid OpenAI API key'
        )
      )
    }
  }

  // Seedream only requires a trimmed non-empty key; no vendor-specific length heuristic is defined.
  if (provider === 'seedream' && (!config.arkApiKey || config.arkApiKey.trim().length === 0)) {
    return Err(
      new ConfigError(
        'ARK_API_KEY is required but not provided',
        'Set ARK_API_KEY environment variable with your BytePlus ModelArk API key'
      )
    )
  }

  return Ok(config)
}

/**
 * Validates the configuration
 * @param config The configuration to validate
 * @returns Result containing validated config or ConfigError
 */
export function validateConfig(config: Config): Result<Config, ConfigError> {
  // Validate IMAGE_PROVIDER
  if (!IMAGE_PROVIDER_VALUES.includes(config.imageProvider)) {
    return Err(
      new ConfigError(
        `Invalid IMAGE_PROVIDER value: "${config.imageProvider}". Valid options: ${IMAGE_PROVIDER_VALUES.join(', ')}`,
        `Set IMAGE_PROVIDER to one of: ${IMAGE_PROVIDER_VALUES.join(', ')}`
      )
    )
  }

  // Requests may select any provider, so startup only requires that at least one
  // provider is usable. The default provider's error is reported when none is.
  const defaultProviderCredentials = validateProviderCredentials(config, config.imageProvider)
  if (!defaultProviderCredentials.success) {
    const hasUsableProvider = IMAGE_PROVIDER_VALUES.some(
      (provider) =>
        provider !== config.imageProvider && validateProviderCredentials(config, provider).success
    )
    if (!hasUsableProvider) {
      return Err(defaultProviderCredentials.error)
    }
  }

  // Validate imageOutputDir (basic check - non-empty string)
  if (!config.imageOutputDir || config.imageOutputDir.trim().length === 0) {
    return Err(
      new ConfigError(
        'IMAGE_OUTPUT_DIR cannot be empty',
        'Set IMAGE_OUTPUT_DIR to a valid directory path'
      )
    )
  }

  // Validate imageQuality
  if (!IMAGE_QUALITY_VALUES.includes(config.imageQuality)) {
    return Err(
      new ConfigError(
        `Invalid IMAGE_QUALITY value: "${config.imageQuality}". Valid options: ${IMAGE_QUALITY_VALUES.join(', ')}`,
        `Set IMAGE_QUALITY to one of: ${IMAGE_QUALITY_VALUES.join(', ')}`
      )
    )
  }

  return Ok(config)
}

/**
 * Loads configuration from environment variables
 * @returns Result containing config or ConfigError
 */
export function getConfig(): Result<Config, ConfigError> {
  const config: Config = {
    imageProvider: (readEnv('IMAGE_PROVIDER') || DEFAULT_CONFIG.imageProvider) as ImageProvider,
    geminiApiKey: readEnv('GEMINI_API_KEY') || '',
    openaiApiKey: readEnv('OPENAI_API_KEY') || '',
    arkApiKey: (readEnv('ARK_API_KEY') || '').trim(),
    imageOutputDir: readEnv('IMAGE_OUTPUT_DIR') || DEFAULT_CONFIG.imageOutputDir,
    skipPromptEnhancement: readEnv('SKIP_PROMPT_ENHANCEMENT') === 'true',
    imageQuality: (readEnv('IMAGE_QUALITY') || 'fast') as ImageQuality,
  }

  return validateConfig(config)
}
