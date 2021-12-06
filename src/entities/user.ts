import { Entity, Enum, ManyToOne, OneToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Organisation from './organisation'
import UserTwoFactorAuth from './user-two-factor-auth'

export enum UserType {
  DEV,
  ADMIN,
  DEMO
}

@Entity()
export default class User {
  @PrimaryKey()
  id: number

  @Property()
  email: string

  @Property({ hidden: true })
  password: string

  @ManyToOne(() => Organisation, { eager: true })
  organisation: Organisation

  @Enum(() => UserType)
  type: UserType = UserType.DEV

  @Property()
  lastSeenAt: Date = new Date()

  @Property({ default: false })
  emailConfirmed: boolean

  @OneToOne({ nullable: true })
  twoFactorAuth: UserTwoFactorAuth

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      lastSeenAt: this.lastSeenAt,
      emailConfirmed: this.emailConfirmed,
      organisation: this.organisation,
      type: this.type,
      has2fa: this.twoFactorAuth?.enabled ?? false
    }
  }
}
