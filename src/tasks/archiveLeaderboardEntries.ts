import { LeaderboardRefreshInterval } from '../entities/leaderboard'
import { MikroORM, EntityManager } from '@mikro-orm/mysql'
import Leaderboard from '../entities/leaderboard'
import ormConfig from '../config/mikro-orm.config'
import LeaderboardEntry from '../entities/leaderboard-entry'
import { isToday, isThisWeek, isThisMonth, isThisYear } from 'date-fns'
import triggerIntegrations from '../lib/integrations/triggerIntegrations'

export async function archiveEntriesForLeaderboard(em: EntityManager, leaderboard: Leaderboard) {
  console.info(`Archiving entries for leaderboard ${leaderboard.id}...`)
  const entries = await em.getRepository(LeaderboardEntry).find({
    leaderboard
  })

  const refreshCheckers = {
    [LeaderboardRefreshInterval.DAILY]: (date: Date) => isToday(date),
    [LeaderboardRefreshInterval.WEEKLY]: (date: Date) => isThisWeek(date, { weekStartsOn: 1 }),
    [LeaderboardRefreshInterval.MONTHLY]: (date: Date) => isThisMonth(date),
    [LeaderboardRefreshInterval.YEARLY]: (date: Date) => isThisYear(date)
  }

  const shouldKeepEntry = refreshCheckers[leaderboard.refreshInterval]
  for (const entry of entries) {
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
}

export default async function archiveLeaderboardEntries() {
  const orm = await MikroORM.init(ormConfig)
  const em = orm.em.fork()

  const leaderboards = await em.getRepository(Leaderboard).find({
    refreshInterval: { $ne: LeaderboardRefreshInterval.NEVER }
  })

  for (const leaderboard of leaderboards) {
    await archiveEntriesForLeaderboard(em, leaderboard)
  }
}
