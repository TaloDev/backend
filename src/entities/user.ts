import { Collection, Entity, Enum, ManyToMany, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import Organisation from './organisation'

export enum UserType {
  DEV,
  ADMIN
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
      organisation: this.organisation
    }
  }
}
