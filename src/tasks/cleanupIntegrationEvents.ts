import { EntityManager } from '@mikro-orm/mysql'
import { subMonths } from 'date-fns'
import { getMikroORM } from '../config/mikro-orm.config'
import GameCenterIntegrationEvent from '../entities/game-center-integration-event'
import GooglePlayGamesIntegrationEvent from '../entities/google-play-games-integration-event'
import SteamworksIntegrationEvent from '../entities/steamworks-integration-event'

export async function cleanupIntegrationEvents() {
  const startTime = performance.now()

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager
  const sixMonthsAgo = subMonths(new Date(), 6)

  const targets = [
    { label: 'Steamworks', entity: SteamworksIntegrationEvent },
    { label: 'Google Play Games', entity: GooglePlayGamesIntegrationEvent },
    { label: 'Game Center', entity: GameCenterIntegrationEvent },
  ]

  const counts = await Promise.all(
    targets.map((t) => em.repo(t.entity).nativeDelete({ createdAt: { $lt: sixMonthsAgo } })),
  )

  const timeTakenSec = (performance.now() - startTime) / 1000

  const parts: string[] = []
  targets.forEach((target, index) => {
    const count = counts[index]
    if (count > 0) {
      const suffix = count === 1 ? 'event' : 'events'
      parts.push(`${count} ${target.label} ${suffix}`)
    }
  })

  if (parts.length > 0) {
    const formatter = new Intl.ListFormat('en', {
      style: 'long',
      type: 'conjunction',
    })

    const listString = formatter.format(parts)
    console.info(`Cleaned up ${listString} in ${timeTakenSec.toFixed(2)}s`)
  }
}
