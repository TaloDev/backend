import { EntityManager } from '@mikro-orm/mysql'
import assert from 'node:assert'
import { getMikroORM } from '../config/mikro-orm.config.js'
import LeaderboardEntry from '../entities/leaderboard-entry.js'
import { LeaderboardRefreshInterval } from '../entities/leaderboard.js'
import Leaderboard from '../entities/leaderboard.js'
import triggerIntegrations from '../lib/integrations/triggerIntegrations.js'
import { deferClearResponseCache } from '../lib/perf/responseCacheQueue.js'
import { streamByCursorPages } from '../lib/perf/streamByCursor.js'

export async function archiveEntriesForLeaderboard(
  baseEm: EntityManager,
  leaderboard: Leaderboard,
) {
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

  const em = baseEm.fork()

  const entryPages = streamByCursorPages(async (batchSize, after) => {
    return em.repo(LeaderboardEntry).findByCursor({
      where: {
        leaderboard,
        deletedAt: null,
      },
      first: batchSize,
      after,
      orderBy: { id: 'asc' },
      populate: ['leaderboard.game'] as const,
      includeCount: false,
    })
  }, 100)

  for await (const entries of entryPages) {
    for (const entry of entries) {
      if (leaderboard.isDateInCurrentPeriod(entry.createdAt)) {
        continue
      }

      entry.deletedAt = new Date()

      const integrationsTriggered = await triggerIntegrations(
        em,
        entry.leaderboard.game,
        (integration) => integration.handleLeaderboardEntryArchived(em, entry),
      )

      // try to avoid rate limits
      if (integrationsTriggered > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    await em.flush()
    em.clear()
  }

  await em.flush()
  await deferClearResponseCache(leaderboard.getEntriesCacheKey(true))
}

export default async function archiveLeaderboardEntries() {
  const orm = await getMikroORM()
  const em = orm.em.fork()

  const leaderboards = await em.repo(Leaderboard).find({
    refreshInterval: { $ne: LeaderboardRefreshInterval.NEVER },
  })

  for (const leaderboard of leaderboards) {
    await archiveEntriesForLeaderboard(em as EntityManager, leaderboard)
  }
}
