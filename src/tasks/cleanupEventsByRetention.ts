import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { subDays } from 'date-fns'
import { getMikroORM } from '../config/mikro-orm.config.js'
import EventRetention from '../entities/event-retention.js'
import Event from '../entities/event.js'
import Game from '../entities/game.js'
import createClickHouseClient from '../lib/clickhouse/createClient.js'
import { purgeEvents } from '../lib/clickhouse/purgeEvents.js'

export async function cleanupEventsByRetention() {
  const startTime = performance.now()

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager
  const clickhouse = createClickHouseClient()

  const retentions = await em.repo(EventRetention).find({}, { populate: ['game'] })
  const gamesWithPurges = new Set<Game>()

  for (const retention of retentions) {
    try {
      const cutoff = subDays(new Date(), retention.retentionDays)
      const deleted = await purgeEvents(clickhouse, retention.game.id, retention.eventName, cutoff)

      if (deleted > 0) {
        gamesWithPurges.add(retention.game)
        console.info(`Deleted ${deleted} ${retention.eventName} events past their retention period`)
      }
    } catch (err) {
      console.error(`Failed to purge ${retention.eventName} events for game ${retention.game.id}`)
      captureException(err)
    }
  }

  await Promise.allSettled([...gamesWithPurges].map((game) => Event.clearCatalogueCache(game)))

  const timeTakenSec = (performance.now() - startTime) / 1000
  console.info(`Event retention cleanup finished in ${timeTakenSec.toFixed(2)}s`)
}
