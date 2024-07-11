import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import User from './user'
import generateSixDigitCode from '../lib/auth/generateSixDigitCode'

@Entity()
export default class UserAccessCode {
  @PrimaryKey()
  id: number

  @Property()
  code: string = generateSixDigitCode()

  @ManyToOne(() => User)
  user: User

  @Property()
  createdAt: Date = new Date()

  @Property({ nullable: true })
  validUntil: Date

  constructor(user: User, validUntil?: Date) {
    this.user = user
    this.validUntil = validUntil
  }
}
