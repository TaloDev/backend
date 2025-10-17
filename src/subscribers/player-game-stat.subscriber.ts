import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue'
import PlayerGameStat from '../entities/player-game-stat'

export class PlayerGameStatSubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [PlayerGameStat]
  }

  clearCacheKeys(playerStat: PlayerGameStat) {
    void deferClearResponseCache(PlayerGameStat.getCacheKey(playerStat.player, playerStat.stat))
    void deferClearResponseCache(PlayerGameStat.getListCacheKey(playerStat.player))
  }

  afterCreate(args: EventArgs<PlayerGameStat>) {
    this.clearCacheKeys(args.entity)
  }

  afterUpdate(args: EventArgs<PlayerGameStat>) {
    this.clearCacheKeys(args.entity)
  }
}
