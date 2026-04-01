import fs from 'fs/promises'
import S3mini from 's3mini'
import { isS3Configured, uploadToS3 } from '../../../src/lib/storage/s3Client'

beforeEach(() => {
  vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('zip content') as unknown as string)
  vi.spyOn(S3mini.prototype, 'putObject').mockResolvedValue({ ok: true, status: 200 } as Response)
  vi.spyOn(S3mini.prototype, 'getPresignedUrl').mockResolvedValue(
    'https://s3.example.com/presigned-url',
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('isS3Configured', () => {
  it('should return true when all required env vars are set', () => {
    vi.stubEnv('STORAGE_DRIVER', 's3')
    vi.stubEnv('S3_ACCESS_KEY_ID', 'key')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret')
    vi.stubEnv('S3_BUCKET', 'my-bucket')

    expect(isS3Configured()).toBe(true)
  })

  it('should return false when STORAGE_DRIVER is not s3', () => {
    vi.stubEnv('STORAGE_DRIVER', 'local')
    vi.stubEnv('S3_ACCESS_KEY_ID', 'key')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret')
    vi.stubEnv('S3_BUCKET', 'my-bucket')

    expect(isS3Configured()).toBe(false)
  })

  it('should return false when STORAGE_DRIVER is not set', () => {
    vi.stubEnv('STORAGE_DRIVER', '')
    vi.stubEnv('S3_ACCESS_KEY_ID', 'key')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret')
    vi.stubEnv('S3_BUCKET', 'my-bucket')

    expect(isS3Configured()).toBe(false)
  })

  it('should return false when S3_ACCESS_KEY_ID is missing', () => {
    vi.stubEnv('STORAGE_DRIVER', 's3')
    vi.stubEnv('S3_ACCESS_KEY_ID', '')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret')
    vi.stubEnv('S3_BUCKET', 'my-bucket')

    expect(isS3Configured()).toBe(false)
  })

  it('should return false when S3_SECRET_ACCESS_KEY is missing', () => {
    vi.stubEnv('STORAGE_DRIVER', 's3')
    vi.stubEnv('S3_ACCESS_KEY_ID', 'key')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', '')
    vi.stubEnv('S3_BUCKET', 'my-bucket')

    expect(isS3Configured()).toBe(false)
  })

  it('should return false when S3_BUCKET is missing', () => {
    vi.stubEnv('STORAGE_DRIVER', 's3')
    vi.stubEnv('S3_ACCESS_KEY_ID', 'key')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret')
    vi.stubEnv('S3_BUCKET', '')

    expect(isS3Configured()).toBe(false)
  })
})

describe('uploadToS3', () => {
  beforeEach(() => {
    vi.stubEnv('STORAGE_DRIVER', 's3')
    vi.stubEnv('S3_ACCESS_KEY_ID', 'key')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret')
    vi.stubEnv('S3_BUCKET', 'my-bucket')
    vi.stubEnv('S3_REGION', 'us-east-1')
    vi.stubEnv('S3_ENDPOINT', 'https://s3.amazonaws.com')
  })

  it('should read the file, upload it and return a presigned URL', async () => {
    const url = await uploadToS3({
      filepath: '/tmp/export.zip',
      key: 'data-exports/game-id=42/export.zip',
    })

    expect(fs.readFile).toHaveBeenCalledWith('/tmp/export.zip')
    expect(S3mini.prototype.putObject).toHaveBeenCalledWith(
      'data-exports/game-id=42/export.zip',
      expect.any(Buffer),
      'application/zip',
    )
    expect(S3mini.prototype.getPresignedUrl).toHaveBeenCalledWith(
      'GET',
      'data-exports/game-id=42/export.zip',
      168 * 60 * 60,
    )
    expect(url).toBe('https://s3.example.com/presigned-url')
  })

  it('should use expiryMinutes when provided', async () => {
    await uploadToS3({
      filepath: '/tmp/export.zip',
      key: 'data-exports/game-id=42/export.zip',
      expiryMinutes: 30,
    })

    expect(S3mini.prototype.getPresignedUrl).toHaveBeenCalledWith(
      'GET',
      'data-exports/game-id=42/export.zip',
      30 * 60,
    )
  })

  it('should throw when upload fails', async () => {
    vi.spyOn(S3mini.prototype, 'putObject').mockResolvedValue({
      ok: false,
      status: 403,
    } as Response)

    await expect(
      uploadToS3({ filepath: '/tmp/export.zip', key: 'data-exports/game-id=42/export.zip' }),
    ).rejects.toThrow('S3 upload failed with status 403')
  })
})
