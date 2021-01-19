import { Entity, PrimaryKey, Property } from '@mikro-orm/core'

@Entity()
export default class User {
  @PrimaryKey()
  id: number

  @Property()
  email: string

  @Property({ hidden: true })
  password: string

  @Property()
  lastSeenAt: Date = new Date()

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt?: Date
}
