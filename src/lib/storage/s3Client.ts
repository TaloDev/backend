import fs from 'fs/promises'
import assert from 'node:assert'
import S3mini from 's3mini'

const DEFAULT_EXPIRY_MINUTES = 168 * 60 // 7 days

function createS3Client() {
  const endpoint = process.env.S3_ENDPOINT ?? 'https://s3.amazonaws.com'
  const bucket = process.env.S3_BUCKET
  assert(bucket, 'S3_BUCKET environment variable is required')
  const endpointWithBucket = endpoint.replace(/\/$/, '') + '/' + bucket

  return new S3mini({
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    endpoint: endpointWithBucket,
    region: process.env.S3_REGION,
  })
}

export function isS3Configured() {
  return (
    process.env.STORAGE_DRIVER === 's3' &&
    Boolean(process.env.S3_ACCESS_KEY_ID) &&
    Boolean(process.env.S3_SECRET_ACCESS_KEY) &&
    Boolean(process.env.S3_BUCKET)
  )
}

export async function uploadToS3({
  filepath,
  key,
  expiryMinutes,
}: {
  filepath: string
  key: string
  expiryMinutes?: number
}) {
  const s3 = createS3Client()
  const data = await fs.readFile(filepath)

  const res = await s3.putObject(key, data, 'application/zip')
  if (!res.ok) {
    throw new Error(`S3 upload failed with status ${res.status}`)
  }

  const expiresIn = (expiryMinutes ?? DEFAULT_EXPIRY_MINUTES) * 60
  return s3.getPresignedUrl('GET', key, expiresIn)
}
