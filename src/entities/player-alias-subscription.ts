import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/mysql'
import { v4 } from 'uuid'
import PlayerAlias from './player-alias'

@Entity()
@Unique({ properties: ['subscriber', 'subscribedTo'] })
@Index({ properties: ['subscribedTo', 'confirmed'] })
export default class PlayerAliasSubscription {
  @PrimaryKey()
  id: string = v4()

  @ManyToOne(() => PlayerAlias, { deleteRule: 'cascade' })
  subscriber: PlayerAlias

  @ManyToOne(() => PlayerAlias, { deleteRule: 'cascade' })
  subscribedTo: PlayerAlias

  @Property()
  confirmed: boolean = false

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(subscriber: PlayerAlias, subscribedTo: PlayerAlias) {
    this.subscriber = subscriber
    this.subscribedTo = subscribedTo
  }

  toJSON() {
    return {
      id: this.id,
      subscriber: this.subscriber,
      subscribedTo: this.subscribedTo,
      confirmed: this.confirmed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
