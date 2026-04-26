import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/es'

@Entity()
export default class FailedJob {
  @PrimaryKey()
  id!: number

  @Property()
  queue!: string

  @Property({ type: 'json', nullable: true })
  payload!: { [key: string]: unknown }

  @Property()
  reason!: string

  @Property({ columnType: 'text' })
  stack!: string

  @Index()
  @Property()
  failedAt: Date = new Date()
}
