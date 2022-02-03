import { Entity, OneToOne, PrimaryKey, Property } from '@mikro-orm/core'
import User from './user'

@Entity()
export default class UserTwoFactorAuth {
  @PrimaryKey()
  id: number

  @OneToOne(() => User, (user) => user.twoFactorAuth)
  user: User

  @Property({ hidden: true })
  secret: string

  @Property({ default: false })
  enabled: boolean

  constructor(secret: string) {
    this.secret = secret
  }

  toJSON() {
    return {
      id: this.id,
      enabled: this.enabled
    }
  }
}
