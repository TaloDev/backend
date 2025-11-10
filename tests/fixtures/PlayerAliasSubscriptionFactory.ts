import { Factory } from 'hefty'
import PlayerAliasSubscription from '../../src/entities/player-alias-subscription'
import PlayerAlias from '../../src/entities/player-alias'

export default class PlayerAliasSubscriptionFactory extends Factory<PlayerAliasSubscription> {
  constructor() {
    super(PlayerAliasSubscription)
  }

  protected definition(): void {
    this.state(() => ({
      confirmed: false
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
}
