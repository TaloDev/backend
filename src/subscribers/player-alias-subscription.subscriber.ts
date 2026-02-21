import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import PlayerAliasSubscription from '../entities/player-alias-subscription'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue'

export class PlayerAliasSubscriptionSubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [PlayerAliasSubscription]
  }

  clearCacheKeys(subscription: PlayerAliasSubscription) {
    void deferClearResponseCache(
      PlayerAliasSubscription.getSubscribersCacheKey(subscription.subscribedTo, true),
    )
    void deferClearResponseCache(
      PlayerAliasSubscription.getSubscriptionsCacheKey(subscription.subscriber, true),
    )
  }

  afterCreate(args: EventArgs<PlayerAliasSubscription>) {
    this.clearCacheKeys(args.entity)
  }

  afterUpdate(args: EventArgs<PlayerAliasSubscription>) {
    this.clearCacheKeys(args.entity)
  }

  afterDelete(args: EventArgs<PlayerAliasSubscription>) {
    this.clearCacheKeys(args.entity)
  }
}
