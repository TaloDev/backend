import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { v4 } from 'uuid'
import User from './user'
import add from 'date-fns/add'

@Entity()
export default class UserSession {
  @PrimaryKey()
  id: number

  @Property()
  token: string = v4()

  @Property({ nullable: true })
  userAgent?: string

  @ManyToOne(() => User)
  user: User

  @Property()
  createdAt: Date = new Date()

  @Property()
  validUntil: Date = add(new Date(), { days: 7 })

  constructor(user: User) {
    this.user = user
  }
}
