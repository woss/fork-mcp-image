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

type ProviderCredentialConfig = {
  configKey: 'geminiApiKey' | 'openaiApiKey' | 'arkApiKey'
  environmentVariable: string
}

const PROVIDER_CREDENTIALS = {
  gemini: {
    configKey: 'geminiApiKey',
    environmentVariable: 'GEMINI_API_KEY',
  },
  openai: {
    configKey: 'openaiApiKey',
    environmentVariable: 'OPENAI_API_KEY',
  },
  seedream: {
    configKey: 'arkApiKey',
    environmentVariable: 'ARK_API_KEY',
  },
} as const satisfies Record<ImageProvider, ProviderCredentialConfig>

/**
 * Validates the API credentials required by a single image provider.
 *
 * Provider selection is a per-request concern, so this check runs after each
 * request resolves its effective provider.
 * @param config The configuration holding the provider API keys
 * @param provider The provider whose credentials should be validated
 * @returns Result containing the config or ConfigError
 */
export function validateProviderCredentials(
  config: Config,
  provider: ImageProvider
): Result<Config, ConfigError> {
  const { configKey, environmentVariable } = PROVIDER_CREDENTIALS[provider]
  const credential = config[configKey]

  if (!credential || credential.trim().length === 0) {
    return Err(
      new ConfigError(
        `The selected image provider "${provider}" is not configured on this server.`,
        `Ask the user to configure ${environmentVariable} and restart the MCP server. After the server restarts, retry generate_image with provider "${provider}".`
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
    arkApiKey: readEnv('ARK_API_KEY') || '',
    imageOutputDir: readEnv('IMAGE_OUTPUT_DIR') || DEFAULT_CONFIG.imageOutputDir,
    skipPromptEnhancement: readEnv('SKIP_PROMPT_ENHANCEMENT') === 'true',
    imageQuality: (readEnv('IMAGE_QUALITY') || 'fast') as ImageQuality,
  }

  return validateConfig(config)
}
