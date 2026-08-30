import * as path from 'node:path'
import { Err, Ok, type Result } from '../types/result.js'
import { SecurityError } from './errors.js'

export class SecurityManager {
  private readonly allowedBasePaths = [
    process.cwd(),
    path.resolve(process.env['IMAGE_OUTPUT_DIR'] || './output'),
    path.resolve('./temp'),
    path.resolve('./tmp'),
    '/tmp',
  ]

  sanitizeFilePath(inputPath: string): Result<string, SecurityError> {
    if (inputPath.includes('\0')) {
      return Err(new SecurityError('Null byte detected in file path'))
    }

    if (inputPath.includes('..')) {
      return Err(new SecurityError('Path traversal attempt detected'))
    }

    const resolvedPath = path.resolve(inputPath)
    const isAllowed = this.allowedBasePaths.some((basePath) => {
      const relativePath = path.relative(path.resolve(basePath), resolvedPath)
      return (
        relativePath === '' ||
        (relativePath !== '..' &&
          !relativePath.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relativePath))
      )
    })

    if (!isAllowed) {
      return Err(new SecurityError('File path outside allowed directories'))
    }

    return Ok(resolvedPath)
  }

  sanitizeFilename(filename: string): string {
    let sanitized = filename.replace(/[\0/\\]/g, '')

    sanitized = sanitized
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0)
        return code > 31 && code !== 127
      })
      .join('')

    sanitized = sanitized.replace(/^\.+|\.+$/g, '').trim()

    if (sanitized.length === 0) {
      sanitized = `secure-file-${Date.now()}`
    }

    return sanitized
  }
}
