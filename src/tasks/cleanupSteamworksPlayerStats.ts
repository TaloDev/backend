import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { getMikroORM } from '../config/mikro-orm.config.js'
import { SteamworksPlayerStat } from '../entities/steamworks-player-stat.js'
import { streamByCursor } from '../lib/perf/streamByCursor.js'

export default async function cleanupSteamworksPlayerStats() {
  const startTime = performance.now()

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const playerStatStream = streamByCursor(async (batchSize, after) => {
    return em.repo(SteamworksPlayerStat).findByCursor({
      where: {
        playerStat: null,
      },
      first: batchSize,
      after,
      orderBy: { id: 'asc' },
      populate: ['stat.game', 'integration'] as const,
    })
  }, 100)

  let processed = 0

  for await (const playerStat of playerStatStream) {
    try {
      await playerStat.integration.cleanupSteamworksPlayerStat(em, playerStat)
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
