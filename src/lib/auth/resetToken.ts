import crypto from 'node:crypto'

const TOKEN_BYTES = 32
const FINGERPRINT_LENGTH = 16

export const RESET_TOKEN_TTL_SECONDS = 900

export function generateResetToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url')
}

export function getResetTokenKey(token: string) {
  return `user:password-reset:${sha256(token)}`
}

// ties outstanding tokens to the password they were issued for, so any password
// change invalidate old links
export function getHashFingerprint(passwordHash: string) {
  return sha256(passwordHash).substring(0, FINGERPRINT_LENGTH)
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}
