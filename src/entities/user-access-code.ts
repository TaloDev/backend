import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import User from './user.js'

@Entity()
export default class UserAccessCode {
  @PrimaryKey()
  id: number

  @Property()
  code: string = this.generateCode()

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

  generateCode() {
    return Math.random().toString().substring(2, 8)
  }
}
