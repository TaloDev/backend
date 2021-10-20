import { Entity, PrimaryKey, Property } from '@mikro-orm/core'

@Entity()
export default class FailedJob {
  @PrimaryKey()
  id: number

  @Property()
  queue: string

  @Property({ type: 'json', nullable: true })
  payload: { [key: string]: unknown }

  @Property()
  reason: string

  @Property()
  failedAt: Date = new Date()
}
