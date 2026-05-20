import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import PlayerGameStat from '../entities/player-game-stat.js'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue.js'

export class PlayerGameStatSubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [PlayerGameStat]
  }

  async clearCacheKeys(playerStat: PlayerGameStat) {
    await deferClearResponseCache(PlayerGameStat.getCacheKey(playerStat.player, playerStat.stat))
    await deferClearResponseCache(PlayerGameStat.getListCacheKey(playerStat.player))
  }

  afterCreate(args: EventArgs<PlayerGameStat>) {
    return this.clearCacheKeys(args.entity)
  }

  afterUpdate(args: EventArgs<PlayerGameStat>) {
    return this.clearCacheKeys(args.entity)
  }
}
