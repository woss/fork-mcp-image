import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileOperationError, SecurityError } from '../../utils/errors'
import * as fileManager from '../fileManager'

describe('FileManager', () => {
  const testOutputDir = path.join(process.cwd(), 'tmp', 'test-output')
  const testImageData = Buffer.from('fake-image-data')

  afterEach(async () => {
    try {
      await fs.rm(testOutputDir, { recursive: true })
    } catch {
      // A test may fail before creating the directory.
    }
  })

  describe('readInputImage', () => {
    it('reads image bytes and derives the MIME type from the resolved file', async () => {
      const inputPath = path.join(testOutputDir, 'input.png')
      await fs.mkdir(testOutputDir, { recursive: true })
      await fs.writeFile(inputPath, testImageData)

      const inputImage = await fileManager.readInputImage(inputPath)

      expect(inputImage).toEqual({ data: testImageData, mimeType: 'image/png' })
    })

    it('resolves symlinks before validating the target extension and MIME type', async () => {
      const targetPath = path.join(testOutputDir, 'target.webp')
      const symlinkPath = path.join(testOutputDir, 'input.png')
      await fs.mkdir(testOutputDir, { recursive: true })
      await fs.writeFile(targetPath, testImageData)
      await fs.symlink(targetPath, symlinkPath)

      const inputImage = await fileManager.readInputImage(symlinkPath)

      expect(inputImage).toEqual({ data: testImageData, mimeType: 'image/webp' })
    })

    it('rejects unsafe and unsupported input paths', async () => {
      const unsupportedPath = path.join(testOutputDir, 'input.txt')
      await fs.mkdir(testOutputDir, { recursive: true })
      await fs.writeFile(unsupportedPath, testImageData)

      await expect(fileManager.readInputImage('/tmp/image.png\0.exe')).rejects.toBeInstanceOf(
        SecurityError
      )
      await expect(fileManager.readInputImage('/tmp/../etc/passwd')).rejects.toMatchObject({
        message: 'Path traversal attempt detected',
      })
      await expect(
        fileManager.readInputImage('/tmp/nonexistent-file-12345.png')
      ).rejects.toMatchObject({ message: 'File path cannot be resolved' })
      await expect(fileManager.readInputImage(unsupportedPath)).rejects.toMatchObject({
        message: 'Unsupported file extension: .txt',
      })
    })
  })

  describe('saveImage', () => {
    it('should save image data to specified path successfully', async () => {
      const outputPath = path.join(testOutputDir, 'test-image.png')

      const result = await fileManager.saveImage(testImageData, outputPath)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(outputPath)
        const savedData = await fs.readFile(outputPath)
        expect(savedData).toEqual(testImageData)
      }
    })

    it('should create directory automatically if it does not exist', async () => {
      const nestedPath = path.join(testOutputDir, 'nested', 'deep', 'test-image.png')

      const result = await fileManager.saveImage(testImageData, nestedPath)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(nestedPath)
        const savedData = await fs.readFile(nestedPath)
        expect(savedData).toEqual(testImageData)
      }
    })

    it('should return FileOperationError when save fails due to invalid path', async () => {
      const invalidPath = '/invalid/\0/path/test.png'

      const result = await fileManager.saveImage(testImageData, invalidPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(FileOperationError)
        expect(result.error.code).toBe('FILE_OPERATION_ERROR')
        expect(result.error.message).toContain('Failed to create directory')
      }
    })
  })

  describe('generateFileName', () => {
    it.each([
      [undefined, 'png'],
      ['image/jpeg', 'jpg'],
      ['image/webp', 'webp'],
      ['image/png', 'png'],
      ['image/gif', 'gif'],
      ['image/bmp', 'bmp'],
      ['image/unknown', 'png'],
    ])('uses the expected extension for MIME type %s', (mimeType, extension) => {
      expect(fileManager.generateFileName(mimeType)).toMatch(
        new RegExp(`^image-\\d{13}-[0-9a-f]{8}\\.${extension}$`)
      )
    })
  })
})
