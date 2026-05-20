import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import GameChannelProp from '../entities/game-channel-prop.js'
import GameChannel from '../entities/game-channel.js'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue.js'

export class GameChannelSubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [GameChannel, GameChannelProp]
  }

  async clearCacheKeys(entity: GameChannel | GameChannelProp) {
    const channel = entity instanceof GameChannel ? entity : entity.gameChannel

    if (!channel) {
      return
    }

    await deferClearResponseCache(GameChannel.getSearchCacheKey(channel.game, true))
    await channel.clearSocketDataKey()
  }

  afterCreate(args: EventArgs<GameChannel | GameChannelProp>) {
    return this.clearCacheKeys(args.entity)
  }

  afterUpdate(args: EventArgs<GameChannel | GameChannelProp>) {
    const changedFields = Object.keys(args.changeSet?.payload ?? {})

    const totalMessagesFields = new Set(['totalMessages', 'updatedAt'])
    if (changedFields.length > 0 && changedFields.every((f) => totalMessagesFields.has(f))) {
      return Promise.resolve()
    }

    return this.clearCacheKeys(args.entity)
  }

  afterDelete(args: EventArgs<GameChannel | GameChannelProp>) {
    return this.clearCacheKeys(args.entity)
  }
}
