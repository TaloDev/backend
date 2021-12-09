import { Collection, Entity, Enum, ManyToOne, OneToMany, OneToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Organisation from './organisation'
import UserRecoveryCode from './user-recovery-code'
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

  @OneToOne({ nullable: true, orphanRemoval: true })
  twoFactorAuth: UserTwoFactorAuth

  @OneToMany(() => UserRecoveryCode, (recoveryCode) => recoveryCode.user, { orphanRemoval: true })
  recoveryCodes: Collection<UserRecoveryCode> = new Collection<UserRecoveryCode>(this)

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
