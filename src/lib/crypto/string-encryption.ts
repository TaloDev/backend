import crypto from 'crypto'

const IV_LENGTH = 16

export function encrypt(text: string, key: string): string {
  const iv = Buffer.from(crypto.randomBytes(IV_LENGTH)).toString('hex').slice(0, IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv)
  let encrypted = cipher.update(text)

  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv + ':' + encrypted.toString('hex')
}

export function decrypt(text: string, key: string): string {
  const textParts: string[] = text.split(':')

  const iv = Buffer.from(textParts.shift()!, 'binary')
  const encryptedText = Buffer.from(textParts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv)
  let decrypted = decipher.update(encryptedText)

  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}
