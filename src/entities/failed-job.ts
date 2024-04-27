import { Entity, PrimaryKey, Property } from '@mikro-orm/mysql'

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

  @Property({ columnType: 'text' })
  stack: string

  @Property()
  failedAt: Date = new Date()
}
