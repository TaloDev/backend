import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import PlayerAliasSubscription from './player-alias-subscription.js'
import { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from './prop.js'

@Entity()
export default class PlayerAliasSubscriptionProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => PlayerAliasSubscription, { deleteRule: 'cascade' })
  subscription: PlayerAliasSubscription

  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Property({ length: MAX_VALUE_LENGTH })
  value: string

  @Property()
  createdAt: Date = new Date()

  constructor(subscription: PlayerAliasSubscription, key: string, value: string) {
    this.subscription = subscription
    this.key = key
    this.value = value
  }

  toJSON() {
    return {
      key: this.key,
      value: this.value,
    }
  }
}
