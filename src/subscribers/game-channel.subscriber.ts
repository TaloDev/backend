import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue'
import GameChannel from '../entities/game-channel'
import GameChannelProp from '../entities/game-channel-prop'

export class GameChannelSubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [GameChannel, GameChannelProp]
  }

  async clearSearchCacheKey(args: EventArgs<GameChannel | GameChannelProp>) {
    const { entity } = args
    const channel = entity instanceof GameChannel ? entity : entity.gameChannel

    if (!channel) {
      // can happen when a prop is being deleted, the reference to the channel is gone
      return
    }

    await deferClearResponseCache(GameChannel.getSearchCacheKey(channel.game, true))
  }

  afterCreate(args: EventArgs<GameChannel | GameChannelProp>) {
    void this.clearSearchCacheKey(args)
  }

  afterUpdate(args: EventArgs<GameChannel | GameChannelProp>) {
    void this.clearSearchCacheKey(args)
  }

  afterDelete(args: EventArgs<GameChannel | GameChannelProp>) {
    void this.clearSearchCacheKey(args)
  }
}
