import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { Required } from 'koa-clay'
import Organisation from './organisation'
import User, { UserType } from './user'

@Entity()
export default class Invite {
  @PrimaryKey()
  id: number

  @Property()
  token: string = this.generateToken()

  @Required()
  @Property()
  email: string

  @Required()
  @Enum(() => UserType)
  type: UserType = UserType.DEV

  @ManyToOne(() => Organisation)
  organisation: Organisation

  @ManyToOne(() => User)
  invitedByUser: User

  @Property()
  createdAt: Date = new Date()

  constructor(organisation: Organisation) {
    this.organisation = organisation
  }

  generateToken(): string {
    const characters = 'ABCDEFGHIJKMNOPQRSTUVWXYZ0123456789'
    let token = ''

    for (let i = 0; i < 10; i++ ) {
      token += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    return token
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      organisation: this.organisation,
      invitedBy: this.invitedByUser.username,
      createdAt: this.createdAt
    }
  }
}