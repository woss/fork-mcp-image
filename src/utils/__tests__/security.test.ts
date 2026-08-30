import * as path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { SecurityError } from '../errors'
import { SecurityManager } from '../security'

describe('SecurityManager', () => {
  let securityManager: SecurityManager

  beforeEach(() => {
    securityManager = new SecurityManager()
  })

  describe('file path sanitization', () => {
    it('should sanitize valid relative path', () => {
      const inputPath = './output/image.png'

      const result = securityManager.sanitizeFilePath(inputPath)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toContain('output')
        expect(result.data).toContain('image.png')
      }
    })

    it('should reject path with null byte', () => {
      const inputPath = './output/image.png\0'

      const result = securityManager.sanitizeFilePath(inputPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(SecurityError)
        expect(result.error.message).toBe('Null byte detected in file path')
        expect(result.error.suggestion).toBe('Ensure your request meets security requirements')
        expect(result.error.code).toBe('SECURITY_ERROR')
      }
    })

    it('should reject path traversal attempt with ../', () => {
      const inputPath = '../../../etc/passwd'

      const result = securityManager.sanitizeFilePath(inputPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(SecurityError)
        expect(result.error.message).toBe('Path traversal attempt detected')
        expect(result.error.suggestion).toBe('Use valid file paths within allowed directories only')
        expect(result.error.code).toBe('SECURITY_ERROR')
      }
    })

    it('should reject path traversal attempt with ..\\', () => {
      const inputPath = '..\\..\\secrets.txt'

      const result = securityManager.sanitizeFilePath(inputPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(SecurityError)
        expect(result.error.message).toContain('Path traversal attempt')
      }
    })

    it('should reject path outside allowed directories', () => {
      const inputPath = '/var/log/system.log'

      const result = securityManager.sanitizeFilePath(inputPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(SecurityError)
        expect(result.error.message).toContain('File path outside allowed directories')
        expect(result.error.suggestion).toContain('allowed directories')
      }
    })

    it('should allow path within current working directory', () => {
      const inputPath = './temp/output.png'

      const result = securityManager.sanitizeFilePath(inputPath)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toContain(process.cwd())
      }
    })

    it('should allow path within temp directory', () => {
      const tempPath = path.join('/tmp', 'test-image.png')

      const result = securityManager.sanitizeFilePath(tempPath)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(tempPath)
      }
    })

    it('should reject a sibling directory that only shares an allowed path prefix', () => {
      const result = securityManager.sanitizeFilePath('/tmp-escape/image.png')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('File path outside allowed directories')
      }
    })

    it('should handle complex path traversal attempts', () => {
      const inputPath = './output/../../../root/.ssh/id_rsa'

      const result = securityManager.sanitizeFilePath(inputPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Path traversal attempt')
      }
    })

    it('should handle mixed separators in path traversal', () => {
      const inputPath = './output\\..\\..\\secrets'

      const result = securityManager.sanitizeFilePath(inputPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Path traversal attempt')
      }
    })
  })
})
