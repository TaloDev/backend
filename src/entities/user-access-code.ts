import { Entity, OneToOne, PrimaryKey, Property } from '@mikro-orm/core'
import User from './user'

@Entity()
export default class UserAccessCode {
  @PrimaryKey()
  id: number

  @Property()
  code: string = this.generateCode()

  @OneToOne(() => User, (user) => user.accessCode)
  user: User

  @Property()
  createdAt: Date = new Date()

  @Property({ nullable: true })
  validUntil: Date

  constructor(user: User, validUntil?: Date) {
    this.user = user
    this.validUntil = validUntil
  }

  generateCode() {
    return Math.random().toString().substring(2, 8)
  }
}
