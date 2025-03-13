import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import User from './user'
import { decrypt, encrypt } from '../lib/crypto/string-encryption'

@Entity()
export default class UserRecoveryCode {
  @PrimaryKey()
  id!: number

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

    return encrypt(code, process.env.RECOVERY_CODES_SECRET!)
  }

  getPlainCode(): string {
    return decrypt(this.code, process.env.RECOVERY_CODES_SECRET!)
  }

  toJSON() {
    return this.getPlainCode()
  }
}
