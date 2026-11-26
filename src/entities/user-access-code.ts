import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import { generateCode } from '../lib/auth/code.js'
import User from './user.js'

@Entity()
export default class UserAccessCode {
  @PrimaryKey()
  id!: number

  @Property()
  code: string = generateCode()

  @ManyToOne(() => User)
  user: User

  @Property()
  createdAt: Date = new Date()

  @Property({ nullable: true })
  validUntil: Date | null = null

  constructor(user: User, validUntil: Date | null) {
    this.user = user
    this.validUntil = validUntil
  }
}
