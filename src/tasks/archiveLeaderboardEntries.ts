import { EntityManager } from '@mikro-orm/mysql'
import { isToday, isThisWeek, isThisMonth, isThisYear } from 'date-fns'
import assert from 'node:assert'
import { getMikroORM } from '../config/mikro-orm.config'
import { LeaderboardRefreshInterval } from '../entities/leaderboard'
import Leaderboard from '../entities/leaderboard'
import LeaderboardEntry from '../entities/leaderboard-entry'
import triggerIntegrations from '../lib/integrations/triggerIntegrations'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue'
import { streamByCursor } from '../lib/perf/streamByCursor'

export async function archiveEntriesForLeaderboard(em: EntityManager, leaderboard: Leaderboard) {
  // this should never happen, but it enforces correct typing for refreshCheckers
  assert(
    leaderboard.refreshInterval !== LeaderboardRefreshInterval.NEVER,
    `Leaderboard ${leaderboard.id} has a NEVER refresh interval, skipping...`,
  )

  /* v8 ignore start -- @preserve */
  if (process.env.NODE_ENV !== 'test') {
    console.info(`Archiving entries for leaderboard ${leaderboard.id}...`)
  }
  /* v8 ignore stop -- @preserve */

  const refreshCheckers = {
    [LeaderboardRefreshInterval.DAILY]: (date: Date) => isToday(date),
    [LeaderboardRefreshInterval.WEEKLY]: (date: Date) => isThisWeek(date, { weekStartsOn: 1 }),
    [LeaderboardRefreshInterval.MONTHLY]: (date: Date) => isThisMonth(date),
    [LeaderboardRefreshInterval.YEARLY]: (date: Date) => isThisYear(date),
  }

  const shouldKeepEntry = refreshCheckers[leaderboard.refreshInterval]

  const entryStream = streamByCursor<LeaderboardEntry>(async (batchSize, after) => {
    return em.repo(LeaderboardEntry).findByCursor(
      {
        leaderboard,
        deletedAt: null,
      },
      {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
      },
    )
  }, 100)

  for await (const entry of entryStream) {
    if (!shouldKeepEntry(entry.createdAt)) {
      entry.deletedAt = new Date()

      // try to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100))
      await triggerIntegrations(em, entry.leaderboard.game, (integration) => {
        return integration.handleLeaderboardEntryArchived(em, entry)
      })
    }
  }

  await em.flush()
  await deferClearResponseCache(leaderboard.getEntriesCacheKey(true))
}

export default async function archiveLeaderboardEntries() {
  const orm = await getMikroORM()
  const em = orm.em.fork()

  const leaderboards = await em.getRepository(Leaderboard).find({
    refreshInterval: { $ne: LeaderboardRefreshInterval.NEVER },
  })

  for (const leaderboard of leaderboards) {
    await archiveEntriesForLeaderboard(em as EntityManager, leaderboard)
  }
}
