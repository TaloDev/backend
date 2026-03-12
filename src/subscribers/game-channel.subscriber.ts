import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import GameChannel from '../entities/game-channel'
import GameChannelProp from '../entities/game-channel-prop'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue'

export class GameChannelSubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [GameChannel, GameChannelProp]
  }

  async clearSearchCacheKey(entity: GameChannel | GameChannelProp) {
    const channel = entity instanceof GameChannel ? entity : entity.gameChannel

    if (!channel) {
      // can happen when a prop is being deleted, the reference to the channel is gone
      return
    }

    await deferClearResponseCache(GameChannel.getSearchCacheKey(channel.game, true))
  }

  afterCreate(args: EventArgs<GameChannel | GameChannelProp>) {
    void this.clearSearchCacheKey(args.entity)
  }

  afterUpdate(args: EventArgs<GameChannel | GameChannelProp>): void | Promise<void> {
    /* v8 ignore next -- @preserve */
    const changedFields = Object.keys(args.changeSet?.payload ?? {})

    // no need to clear the cache for a message count update
    const totalMessagesFields = new Set(['totalMessages', 'updatedAt'])
    if (changedFields.length > 0 && changedFields.every((f) => totalMessagesFields.has(f))) {
      return
    }

    void this.clearSearchCacheKey(args.entity)
  }

  afterDelete(args: EventArgs<GameChannel | GameChannelProp>) {
    void this.clearSearchCacheKey(args.entity)
  }
}
