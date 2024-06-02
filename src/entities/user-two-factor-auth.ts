import { Entity, OneToOne, PrimaryKey, Property, Rel } from '@mikro-orm/mysql'
import User from './user.js'

@Entity()
export default class UserTwoFactorAuth {
  @PrimaryKey()
  id: number

  @OneToOne(() => User, (user) => user.twoFactorAuth)
  user: Rel<User>

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
