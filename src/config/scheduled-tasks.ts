import archiveLeaderboardEntries from '../tasks/archiveLeaderboardEntries'
import createQueue from '../lib/queues/createQueue'
import deleteInactivePlayers from '../tasks/deleteInactivePlayers'
import cleanupOnlinePlayers from '../tasks/cleanupOnlinePlayers'
import cleanupSteamworksLeaderboardEntries from '../tasks/cleanupSteamworksLeaderboardEntries'
import cleanupSteamworksPlayerStats from '../tasks/cleanupSteamworksPlayerStats'
import deletePlayers from '../tasks/deletePlayers'


function addScheduledTask(name: string, task: () => Promise<void>, pattern: string) {
  return createQueue(name, task).upsertJobScheduler(
    `${name}-scheduler`,
    { pattern },
    { name: `${name}-job` }
  )
}

export async function initScheduledTasks() {
  const tasks = [
    addScheduledTask('archive-leaderboard-entries', archiveLeaderboardEntries, '0 0 0 * * *'), // midnight daily
    addScheduledTask('delete-inactive-players', deleteInactivePlayers, '0 0 0 1 * *'), // midnight on the first day of the month
    addScheduledTask('cleanup-online-players', cleanupOnlinePlayers, '0 */10 * * * *'), // every 10 minutes
    addScheduledTask('cleanup-steamworks-leaderboard-entries', cleanupSteamworksLeaderboardEntries, '0 0 */1 * * *'), // every hour
    addScheduledTask('cleanup-steamworks-player-stats', cleanupSteamworksPlayerStats, '0 0 */1 * * *') // every hour
  ]

  /* v8 ignore next 3 */
  if (process.env.NODE_ENV !== 'test') {
    tasks.push(addScheduledTask('delete-players', deletePlayers, '0 */2 * * * *')) // every 2 mins
  }

  await Promise.all(tasks)
}
