import { EntityManager } from '@mikro-orm/mysql'
import { subMonths } from 'date-fns'
import { getMikroORM } from '../config/mikro-orm.config'
import GooglePlayGamesIntegrationEvent from '../entities/google-play-games-integration-event'
import SteamworksIntegrationEvent from '../entities/steamworks-integration-event'

export async function cleanupIntegrationEvents() {
  const startTime = performance.now()

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const sixMonthsAgo = subMonths(new Date(), 6)

  const [steamworksDeleted, gpgDeleted] = await Promise.all([
    em.repo(SteamworksIntegrationEvent).nativeDelete({ createdAt: { $lt: sixMonthsAgo } }),
    em.repo(GooglePlayGamesIntegrationEvent).nativeDelete({ createdAt: { $lt: sixMonthsAgo } }),
  ])

  const endTime = performance.now()
  const timeTakenSec = (endTime - startTime) / 1000
  console.info(
    `Cleaned up ${steamworksDeleted} Steamworks and ${gpgDeleted} Google Play Games integration events in ${timeTakenSec.toFixed(2)}s`,
  )
}
