import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import LeaderboardEntry from '../entities/leaderboard-entry'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue'

export class LeaderboardEntrySubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [LeaderboardEntry]
  }

  clearCacheKeys(entry: LeaderboardEntry) {
    void deferClearResponseCache(entry.leaderboard.getEntriesCacheKey(true))
  }

  afterCreate(args: EventArgs<LeaderboardEntry>) {
    this.clearCacheKeys(args.entity)
  }

  afterUpdate(args: EventArgs<LeaderboardEntry>) {
    this.clearCacheKeys(args.entity)
  }
}
