import { EntityManager, NotFoundError } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { getMikroORM } from '../config/mikro-orm.config'
import Integration, { IntegrationType } from '../entities/integration'
import { SteamworksPlayerStat } from '../entities/steamworks-player-stat'
import { streamByCursor } from '../lib/perf/streamByCursor'

export default async function cleanupSteamworksPlayerStats() {
  const startTime = performance.now()

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const playerStatStream = streamByCursor<SteamworksPlayerStat>(async (batchSize, after) => {
    return em.repo(SteamworksPlayerStat).findByCursor(
      {
        playerStat: null,
      },
      {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        populate: ['stat.game'] as const,
      },
    )
  }, 100)

  const integrationsMap = new Map<number, Integration>()
  let processed = 0

  for await (const playerStat of playerStatStream) {
    try {
      const game = playerStat.stat.game
      let integration = integrationsMap.get(game.id)
      if (!integration) {
        try {
          integration = await em
            .repo(Integration)
            .findOneOrFail({ game, type: IntegrationType.STEAMWORKS })
        } catch (err) {
          if (err instanceof NotFoundError) {
            await em.repo(SteamworksPlayerStat).nativeDelete(playerStat.id)
            continue
          }
          /* v8 ignore next */
          throw err
        }
        integrationsMap.set(game.id, integration)
      }

      await integration.cleanupSteamworksPlayerStat(em, playerStat)
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (err) {
      console.error(
        `Steamworks player stat cleanup failed (${playerStat.stat.internalName}, ${playerStat.steamUserId}):`,
        (err as Error).message,
      )
      captureException(err)
    } finally {
      processed++
    }
  }

  const endTime = performance.now()
  const timeTakenSec = (endTime - startTime) / 1000
  console.info(`Cleaned up ${processed} Steamworks player stats in ${timeTakenSec.toFixed(2)}s`)
}
