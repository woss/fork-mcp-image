import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses'
import type { Result } from '../types/result.js'
import { Err, Ok } from '../types/result.js'
import { ImageAPIError } from '../utils/errors.js'
import { DEFAULT_MIME_TYPE, normalizeMimeType } from '../utils/mimeUtils.js'
import { type GenerationConfig, MAX_TEXT_PROMPT_LENGTH } from './textClient.js'

type OpenAICompatibleInput = NonNullable<ResponseCreateParamsNonStreaming['input']>

export function buildOpenAICompatibleInput(
  prompt: string,
  config: GenerationConfig
): OpenAICompatibleInput {
  if (!config.inputImage) {
    return prompt
  }

  const mimeType = normalizeMimeType(config.inputImageMimeType ?? DEFAULT_MIME_TYPE)

  return [
    {
      role: 'user' as const,
      content: [
        {
          type: 'input_text' as const,
          text: prompt,
        },
        {
          type: 'input_image' as const,
          image_url: `data:${mimeType};base64,${config.inputImage}`,
          detail: 'auto' as const,
        },
      ],
    },
  ]
}

export function validateOpenAICompatiblePrompt(prompt: string): Result<true, ImageAPIError> {
  if (!prompt || prompt.trim().length === 0) {
    return Err(new ImageAPIError('Empty prompt provided', 'Please provide a non-empty prompt'))
  }

  if (prompt.length > MAX_TEXT_PROMPT_LENGTH) {
    return Err(new ImageAPIError('Prompt too long', 'Please provide a shorter prompt'))
  }

  return Ok(true)
}
