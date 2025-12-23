import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/mysql'
import PlayerAlias from './player-alias'

export enum RelationshipType {
  UNIDIRECTIONAL = 'unidirectional',
  BIDIRECTIONAL = 'bidirectional'
}

@Entity()
@Unique({ properties: ['subscriber', 'subscribedTo'] })
@Index({ properties: ['subscribedTo', 'confirmed'] })
export default class PlayerAliasSubscription {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => PlayerAlias, { deleteRule: 'cascade', eager: true })
  subscriber: PlayerAlias

  @ManyToOne(() => PlayerAlias, { deleteRule: 'cascade', eager: true })
  subscribedTo: PlayerAlias

  @Property()
  confirmed: boolean = false

  @Enum(() => RelationshipType)
  relationshipType: RelationshipType = RelationshipType.UNIDIRECTIONAL

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(subscriber: PlayerAlias, subscribedTo: PlayerAlias, relationshipType: RelationshipType) {
    this.subscriber = subscriber
    this.subscribedTo = subscribedTo
    this.relationshipType = relationshipType
  }

  toJSON() {
    return {
      id: this.id,
      subscriber: this.subscriber,
      subscribedTo: this.subscribedTo,
      confirmed: this.confirmed,
      relationshipType: this.relationshipType,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
