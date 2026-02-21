import { EntityManager, NotFoundError } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { getMikroORM } from '../config/mikro-orm.config'
import Integration, { IntegrationType } from '../entities/integration'
import { SteamworksLeaderboardEntry } from '../entities/steamworks-leaderboard-entry'
import { streamByCursor } from '../lib/perf/streamByCursor'

export default async function cleanupSteamworksLeaderboardEntries() {
  const startTime = performance.now()

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const entryStream = streamByCursor<SteamworksLeaderboardEntry>(async (batchSize, after) => {
    return em.repo(SteamworksLeaderboardEntry).findByCursor(
      {
        leaderboardEntry: null,
      },
      {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        populate: ['steamworksLeaderboard.leaderboard.game'] as const,
      },
    )
  }, 100)

  const integrationsMap = new Map<number, Integration>()
  let processed = 0

  for await (const entry of entryStream) {
    try {
      const game = entry.steamworksLeaderboard.leaderboard.game
      let integration = integrationsMap.get(game.id)
      if (!integration) {
        try {
          integration = await em
            .repo(Integration)
            .findOneOrFail({ game, type: IntegrationType.STEAMWORKS })
        } catch (err) {
          if (err instanceof NotFoundError) {
            await em.repo(SteamworksLeaderboardEntry).nativeDelete(entry.id)
            continue
          }
          /* v8 ignore next */
          throw err
        }
        integrationsMap.set(game.id, integration)
      }

      await integration.cleanupSteamworksLeaderboardEntry(em, entry)
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
