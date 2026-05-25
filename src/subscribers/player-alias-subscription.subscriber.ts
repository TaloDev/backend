import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import PlayerAliasSubscription from '../entities/player-alias-subscription.js'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue.js'

export class PlayerAliasSubscriptionSubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [PlayerAliasSubscription]
  }

  async clearCacheKeys(subscription: PlayerAliasSubscription) {
    await deferClearResponseCache(
      PlayerAliasSubscription.getSubscribersCacheKey(subscription.subscribedTo, true),
    )
    await deferClearResponseCache(
      PlayerAliasSubscription.getSubscriptionsCacheKey(subscription.subscriber, true),
    )
  }

  afterCreate(args: EventArgs<PlayerAliasSubscription>) {
    return this.clearCacheKeys(args.entity)
  }

  afterUpdate(args: EventArgs<PlayerAliasSubscription>) {
    return this.clearCacheKeys(args.entity)
  }

  afterDelete(args: EventArgs<PlayerAliasSubscription>) {
    return this.clearCacheKeys(args.entity)
  }
}
