import { EventArgs, EventSubscriber } from '@mikro-orm/mysql'
import LeaderboardEntry from '../entities/leaderboard-entry'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue'

export class LeaderboardEntrySubscriber implements EventSubscriber {
  getSubscribedEntities() {
    return [LeaderboardEntry]
  }

  async clearCacheKeys(entry: LeaderboardEntry) {
    await deferClearResponseCache(entry.leaderboard.getEntriesCacheKey(true))
  }

  createPropsDigest(entry: LeaderboardEntry) {
    return LeaderboardEntry.createPropsDigest(entry.props.getItems())
  }

  beforeCreate(args: EventArgs<LeaderboardEntry>) {
    args.entity.propsDigest = this.createPropsDigest(args.entity)
  }

  async afterCreate(args: EventArgs<LeaderboardEntry>) {
    await this.clearCacheKeys(args.entity)
  }

  beforeUpdate(args: EventArgs<LeaderboardEntry>) {
    if (args.entity.props.isDirty()) {
      args.entity.propsDigest = this.createPropsDigest(args.entity)
    }
  }

  async afterUpdate(args: EventArgs<LeaderboardEntry>) {
    await this.clearCacheKeys(args.entity)
  }
}
