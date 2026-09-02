import { Entity, Enum, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es'
import Organisation from './organisation.js'
import User, { UserType } from './user.js'

@Entity()
@Unique({ properties: ['user', 'organisation'] })
export default class OrganisationMember {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => User, { eager: true })
  user!: User

  @ManyToOne(() => Organisation, { eager: true })
  organisation!: Organisation

  @Enum(() => UserType)
  type: UserType = UserType.DEV

  @Property()
  createdAt: Date = new Date()

  constructor(user: User, organisation: Organisation, type: UserType) {
    this.user = user
    this.organisation = organisation
    this.type = type
  }

  toJSON() {
    return {
      id: this.id,
      organisation: this.organisation,
      type: this.type,
      createdAt: this.createdAt,
    }
  }
}
