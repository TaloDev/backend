import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import { add } from 'date-fns'
import { v4 } from 'uuid'
import User from './user'

@Entity()
export default class UserSession {
  @PrimaryKey()
  id!: number

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
