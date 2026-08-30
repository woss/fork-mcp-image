import * as path from 'node:path'
import type { ImageOutputFormat } from '../types/mcp.js'
import { Logger } from './logger.js'

const logger = new Logger()

const MIME_TO_EXTENSION: ReadonlyMap<string, string> = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/bmp', '.bmp'],
])

const EXTENSION_TO_MIME: ReadonlyMap<string, string> = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.bmp', 'image/bmp'],
])

export const DEFAULT_MIME_TYPE = 'image/png'
const DEFAULT_EXTENSION = '.png'
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])

export const SUPPORTED_MIME_TYPES: readonly string[] = [...MIME_TO_EXTENSION.keys()]

export const SUPPORTED_EXTENSIONS: readonly string[] = [...EXTENSION_TO_MIME.keys()]

export function getExtensionFromMimeType(mimeType: string): string {
  const extension = MIME_TO_EXTENSION.get(mimeType)
  if (extension) {
    return extension
  }

  logger.warn('mimeUtils', `Unknown MIME type encountered, falling back to ${DEFAULT_EXTENSION}`, {
    mimeType,
  })
  return DEFAULT_EXTENSION
}

export function getMimeTypeFromExtension(ext: string): string {
  const normalized = ext.toLowerCase()
  return EXTENSION_TO_MIME.get(normalized) ?? DEFAULT_MIME_TYPE
}

export function normalizeMimeType(mimeType: string): string {
  if (MIME_TO_EXTENSION.has(mimeType)) {
    return mimeType
  }
  logger.warn('mimeUtils', `Unknown MIME type, normalizing to ${DEFAULT_MIME_TYPE}`, { mimeType })
  return DEFAULT_MIME_TYPE
}

export function resolvePreferredOutputFormat(fileName?: string): ImageOutputFormat | undefined {
  if (!fileName) {
    return undefined
  }

  const extension = path.extname(fileName).toLowerCase()
  if (extension === '.png') {
    return 'png'
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'jpeg'
  }
  return undefined
}

export function getMimeTypeForOutputFormat(format: ImageOutputFormat): 'image/png' | 'image/jpeg' {
  return format === 'jpeg' ? 'image/jpeg' : 'image/png'
}

export function matchesImageDataMimeType(
  imageData: Buffer,
  mimeType: 'image/png' | 'image/jpeg'
): boolean {
  const signature = mimeType === 'image/png' ? PNG_SIGNATURE : JPEG_SIGNATURE
  return (
    imageData.length >= signature.length &&
    imageData.subarray(0, signature.length).equals(signature)
  )
}

/**
 * Ensure a filename has an appropriate file extension based on MIME type.
 * - A recognized extension is preserved only when it matches the actual MIME type.
 * - A recognized mismatched extension is replaced with the actual canonical extension.
 * - Missing or unrecognized extensions are completed without discarding the caller's basename.
 */
export function reconcileFileNameExtension(fileName: string, mimeType: string): string {
  const originalExtension = path.extname(fileName)
  const normalizedExtension = originalExtension.toLowerCase()
  const extensionMimeType = EXTENSION_TO_MIME.get(normalizedExtension)
  if (extensionMimeType === mimeType) {
    return fileName
  }

  const newExt = getExtensionFromMimeType(mimeType)
  if (extensionMimeType) {
    return `${fileName.slice(0, -originalExtension.length)}${newExt}`
  }
  return `${fileName}${newExt}`
}
