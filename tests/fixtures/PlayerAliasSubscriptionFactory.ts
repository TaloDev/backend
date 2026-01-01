import { Factory } from 'hefty'
import PlayerAliasSubscription, { RelationshipType } from '../../src/entities/player-alias-subscription'
import PlayerAlias from '../../src/entities/player-alias'

export default class PlayerAliasSubscriptionFactory extends Factory<PlayerAliasSubscription> {
  constructor() {
    super(PlayerAliasSubscription)
  }

  protected override definition() {
    this.state(() => ({
      confirmed: false,
      relationshipType: RelationshipType.UNIDIRECTIONAL
    }))
  }

  withSubscriber(subscriber: PlayerAlias): this {
    return this.state(() => ({
      subscriber
    }))
  }

  withSubscribedTo(subscribedTo: PlayerAlias): this {
    return this.state(() => ({
      subscribedTo
    }))
  }

  confirmed(): this {
    return this.state(() => ({
      confirmed: true
    }))
  }

  pending(): this {
    return this.state(() => ({
      confirmed: false
    }))
  }

  unidirectional(): this {
    return this.state(() => ({
      relationshipType: RelationshipType.UNIDIRECTIONAL
    }))
  }

  bidirectional(): this {
    return this.state(() => ({
      relationshipType: RelationshipType.BIDIRECTIONAL
    }))
  }
}
