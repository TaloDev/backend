import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/es'
import { Collection } from '@mikro-orm/mysql'
import PlayerAliasSubscriptionProp from './player-alias-subscription-prop.js'
import PlayerAlias from './player-alias.js'

export enum RelationshipType {
  UNIDIRECTIONAL = 'unidirectional',
  BIDIRECTIONAL = 'bidirectional',
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

  @OneToMany(() => PlayerAliasSubscriptionProp, (prop) => prop.subscription, {
    eager: true,
    orphanRemoval: true,
  })
  props: Collection<PlayerAliasSubscriptionProp> = new Collection<PlayerAliasSubscriptionProp>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  static getSubscribersCacheKey(alias: PlayerAlias, wildcard = false) {
    let key = `subscribers-${alias.id}`
    if (wildcard) key += '-*'
    return key
  }

  static getSubscriptionsCacheKey(alias: PlayerAlias, wildcard = false) {
    let key = `subscriptions-${alias.id}`
    if (wildcard) key += '-*'
    return key
  }

  constructor(
    subscriber: PlayerAlias,
    subscribedTo: PlayerAlias,
    relationshipType: RelationshipType,
  ) {
    this.subscriber = subscriber
    this.subscribedTo = subscribedTo
    this.relationshipType = relationshipType
  }

  setProps(props: { key: string; value: string }[]) {
    this.props.set(props.map(({ key, value }) => new PlayerAliasSubscriptionProp(this, key, value)))
  }

  toJSON() {
    return {
      id: this.id,
      subscriber: this.subscriber,
      subscribedTo: this.subscribedTo,
      confirmed: this.confirmed,
      relationshipType: this.relationshipType,
      props: this.props,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
