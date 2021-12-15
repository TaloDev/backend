import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import User from './user'
import crypto from 'crypto'

const IV_LENGTH = 16

@Entity()
export default class UserRecoveryCode {
  @PrimaryKey()
  id: number

  @ManyToOne(() => User)
  user: User

  @Property()
  code: string = this.generateCode()

  @Property()
  createdAt: Date = new Date()

  constructor(user: User) {
    this.user = user
  }

  generateCode(): string {
    const characters = 'ABCDEFGHIJKMNOPQRSTUVWXYZ0123456789'
    let code = ''

    for (let i = 0; i < 10; i++ ) {
      code += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    const iv = Buffer.from(crypto.randomBytes(IV_LENGTH)).toString('hex').slice(0, IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.RECOVERY_CODES_SECRET), iv)
    let encrypted = cipher.update(code)

    encrypted = Buffer.concat([encrypted, cipher.final()])
    return iv + ':' + encrypted.toString('hex')
  }

  getPlainCode(): string {
    const textParts: string[] = this.code.split(':')

    const iv = Buffer.from(textParts.shift(), 'binary')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(process.env.RECOVERY_CODES_SECRET), iv)
    let decrypted = decipher.update(encryptedText)

    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  }

  toJSON() {
    return this.getPlainCode()
  }
}
