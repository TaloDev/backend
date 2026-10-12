import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import PlayerAliasSubscriptionProp from '../entities/player-alias-subscription-prop.js'
import PlayerAliasSubscription from '../entities/player-alias-subscription.js'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue.js'

export class PlayerAliasSubscriptionSubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [PlayerAliasSubscription, PlayerAliasSubscriptionProp]
  }

  async clearCacheKeys(entity: PlayerAliasSubscription | PlayerAliasSubscriptionProp) {
    const subscription = entity instanceof PlayerAliasSubscription ? entity : entity.subscription

    if (!subscription) {
      return
    }

    await deferClearResponseCache(
      PlayerAliasSubscription.getSubscribersCacheKey(subscription.subscribedTo, true),
    )
    await deferClearResponseCache(
      PlayerAliasSubscription.getSubscriptionsCacheKey(subscription.subscriber, true),
    )
  }

  afterCreate(args: EventArgs<PlayerAliasSubscription | PlayerAliasSubscriptionProp>) {
    return this.clearCacheKeys(args.entity)
  }

  afterUpdate(args: EventArgs<PlayerAliasSubscription | PlayerAliasSubscriptionProp>) {
    return this.clearCacheKeys(args.entity)
  }

  afterDelete(args: EventArgs<PlayerAliasSubscription | PlayerAliasSubscriptionProp>) {
    return this.clearCacheKeys(args.entity)
  }
}
