import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { getMikroORM } from '../config/mikro-orm.config.js'
import { SteamworksLeaderboardEntry } from '../entities/steamworks-leaderboard-entry.js'
import { streamByCursor } from '../lib/perf/streamByCursor.js'

export default async function cleanupSteamworksLeaderboardEntries() {
  const startTime = performance.now()

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const entryStream = streamByCursor(async (batchSize, after) => {
    return em.repo(SteamworksLeaderboardEntry).findByCursor({
      where: {
        leaderboardEntry: null,
      },
      first: batchSize,
      after,
      orderBy: { id: 'asc' },
      populate: [
        'steamworksLeaderboard.integration',
        'steamworksLeaderboard.leaderboard.game',
      ] as const,
    })
  }, 100)

  let processed = 0

  for await (const entry of entryStream) {
    try {
      await entry.steamworksLeaderboard.integration.cleanupSteamworksLeaderboardEntry(em, entry)
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (err) {
      console.error(
        `Steamworks leaderboard entry cleanup failed (${entry.steamworksLeaderboard.steamworksLeaderboardId}, ${entry.steamUserId}):`,
        (err as Error).message,
      )
      captureException(err)
    } finally {
      processed++
    }
  }

  const endTime = performance.now()
  const timeTakenSec = (endTime - startTime) / 1000
  console.info(
    `Cleaned up ${processed} Steamworks leaderboard entries in ${timeTakenSec.toFixed(2)}s`,
  )
}
