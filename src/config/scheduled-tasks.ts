import archiveLeaderboardEntries from '../tasks/archiveLeaderboardEntries'
import createQueue from '../lib/queues/createQueue'
import deleteInactivePlayers from '../tasks/deleteInactivePlayers'
import cleanupOnlinePlayers from '../tasks/cleanupOnlinePlayers'
import cleanupSteamworksLeaderboardEntries from '../tasks/cleanupSteamworksLeaderboardEntries'
import cleanupSteamworksPlayerStats from '../tasks/cleanupSteamworksPlayerStats'


function addScheduledTask(name: string, task: () => Promise<void>, pattern: string) {
  return createQueue(name, task).upsertJobScheduler(
    `${name}-scheduler`,
    { pattern },
    { name: `${name}-job` }
  )
}

export default async function initScheduledTasks() {
  await Promise.all([
    addScheduledTask('archive-leaderboard-entries', archiveLeaderboardEntries, '0 0 0 * * *'), // midnight daily
    addScheduledTask('delete-inactive-players', deleteInactivePlayers, '0 0 0 1 * *'), // midnight on the first day of the month
    addScheduledTask('cleanup-online-players', cleanupOnlinePlayers, '0 0 */4 * * *'), // every 4 hours
    addScheduledTask('cleanup-steamworks-leaderboard-entries', cleanupSteamworksLeaderboardEntries, '0 0 */1 * * *'), // every hour
    addScheduledTask('cleanup-steamworks-player-stats', cleanupSteamworksPlayerStats, '0 0 */1 * * *') // every hour
  ])
}
