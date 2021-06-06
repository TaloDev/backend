import { Entity, Enum, ManyToOne, OneToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Organisation from './organisation'
import UserAccessCode from './user-access-code'

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

  @OneToOne(() => UserAccessCode, (accessCode) => accessCode.user, { owner: true, orphanRemoval: true, nullable: true })
  accessCode: UserAccessCode

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
      type: this.type
    }
  }
}
